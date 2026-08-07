"""Explainable EMA/RSI/ATR breakout scalper.

The strategy is intentionally rule based. It uses only closed candles,
opens at most one long or short position, and manages stop-loss, take-profit,
maximum holding time, cooldown and daily loss limits in the shared worker.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from math import isfinite
from typing import Any

from sqlalchemy import desc

from app.bot_engine.bybit.client import get_bybit_session
from app.bot_engine.events import log_bot_event
from app.bot_engine.grid_runtime import (
    cancel_all_bot_orders,
    ensure_live_trading_allowed,
    get_order_link_prefix,
    sync_bot_orders,
)
from app.bot_engine.market_data import get_instrument_rules, get_last_price, get_ticker_snapshot
from app.bot_engine.orders import (
    ACTIVE_ORDER_STATUSES,
    OrderRequest,
    normalize_order_request,
    place_order,
    validate_order_request,
)
from app.bot_engine.positions import get_open_positions
from app.core.clock import utcnow
from app.models.trading_bot import TradingBot
from app.models.trading_bot_event import TradingBotEvent
from app.models.trading_bot_order import TradingBotOrder


@dataclass(slots=True)
class Candle:
    open_time: int
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass(slots=True)
class Signal:
    side: str
    score: float
    price: float
    atr: float
    candle_time: int
    reasons: list[str]
    indicators: dict[str, float]


def _float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
        return result if isfinite(result) else default
    except (TypeError, ValueError):
        return default


def _fmt(value: Any) -> str | None:
    if value is None:
        return None
    numeric = _float(value)
    return f"{numeric:.12f}".rstrip("0").rstrip(".") if numeric else "0"


def _ensure_accepted(response: dict, action: str) -> None:
    code = response.get("retCode")
    if code is None or str(code) == "0":
        return
    message = response.get("retMsg") or response.get("retMessage") or "Unknown exchange error"
    raise ValueError(f"{action} rejected by exchange ({code}): {message}")


def _interval_seconds(interval: str) -> int:
    return {
        "1": 60, "3": 180, "5": 300, "15": 900, "30": 1800,
        "60": 3600, "120": 7200, "240": 14400, "360": 21600,
        "720": 43200, "D": 86400, "W": 604800, "M": 2592000,
    }.get(str(interval), 300)


def _settings(bot: TradingBot) -> dict:
    # Revision 2 is deliberately more selective.  The first year-long BTC test
    # showed that the raw signal logic was close to flat before fees, while the
    # large number of marginal entries made fees dominate the result.  Existing
    # v1 bots are upgraded in-memory to the safer floor values below, while any
    # user setting that is already stricter is preserved.
    raw = dict(bot.settings or {})
    value = {
        "strategy_revision": 2,
        "timeframe": "5",
        "lookback_candles": 200,
        "ema_fast_period": 20,
        "ema_slow_period": 50,
        "rsi_period": 14,
        "atr_period": 14,
        "breakout_lookback": 20,
        "volume_lookback": 20,
        "volume_multiplier": 3.0,
        "minimum_signal_score": 0.85,
        "require_trend_confirmation": True,
        "require_breakout_confirmation": True,
        "require_volume_confirmation": True,
        "breakout_buffer_atr": 0.05,
        "minimum_body_atr": 0.25,
        "rsi_long_min": 50.0,
        "rsi_long_max": 72.0,
        "rsi_short_min": 28.0,
        "rsi_short_max": 50.0,
        "stop_loss_atr": 1.2,
        "take_profit_atr": 1.8,
        "max_holding_minutes": 30,
        "cooldown_minutes": 15,
        "risk_per_trade_percent": 0.5,
        "max_daily_loss_percent": 2.0,
        "allow_short": True,
        "position_sizing": "risk_capped",
        "max_position_qty": float(bot.order_qty),
        "max_open_orders": 1,
        "max_notional_usdt": None,
        "allow_live_trading": False,
        "stop_bot_on_error": True,
        "cancel_orders_on_stop": True,
        "run_interval_seconds": 5,
    }
    value.update(raw)

    revision = int(_float(raw.get("strategy_revision"), 1))
    if revision < 2:
        value["strategy_revision"] = 2
        value["minimum_signal_score"] = max(_float(value.get("minimum_signal_score"), 0.0), 0.85)
        value["volume_multiplier"] = max(_float(value.get("volume_multiplier"), 0.0), 3.0)
        value["cooldown_minutes"] = max(_float(value.get("cooldown_minutes"), 0.0), 15.0)
        value["require_trend_confirmation"] = True
        value["require_breakout_confirmation"] = True
        value["require_volume_confirmation"] = True
        value["breakout_buffer_atr"] = max(_float(value.get("breakout_buffer_atr"), 0.0), 0.05)
        value["minimum_body_atr"] = max(_float(value.get("minimum_body_atr"), 0.0), 0.25)

    value["timeframe"] = str(value.get("timeframe") or "5")
    for key, minimum in (
        ("lookback_candles", 60), ("ema_fast_period", 2), ("ema_slow_period", 3),
        ("rsi_period", 2), ("atr_period", 2), ("breakout_lookback", 2),
        ("volume_lookback", 2), ("max_open_orders", 1),
    ):
        value[key] = max(int(value.get(key) or minimum), minimum)
    value["max_position_qty"] = max(_float(value.get("max_position_qty"), bot.order_qty), 0)
    return value


def _state(bot: TradingBot) -> dict:
    return deepcopy((bot.settings or {}).get("pattern_scalper_state") or {})


def _save_state(db, bot: TradingBot, state: dict) -> None:
    # JSON columns do not track nested in-place changes. Deep copies ensure each
    # state transition is detected and persisted instead of reusing stale data.
    settings = deepcopy(dict(bot.settings or {}))
    settings["pattern_scalper_state"] = deepcopy(state)
    bot.settings = settings
    db.add(bot)


def _ema(values: list[float], period: int) -> list[float]:
    if not values:
        return []
    alpha = 2 / (period + 1)
    result = [values[0]]
    for value in values[1:]:
        result.append(value * alpha + result[-1] * (1 - alpha))
    return result


def _rsi(values: list[float], period: int) -> float:
    if len(values) <= period:
        return 50.0
    gains: list[float] = []
    losses: list[float] = []
    for previous, current in zip(values[-period - 1:-1], values[-period:]):
        change = current - previous
        gains.append(max(change, 0))
        losses.append(max(-change, 0))
    gain = sum(gains) / period
    loss = sum(losses) / period
    if loss <= 1e-15:
        return 100.0 if gain > 0 else 50.0
    return 100 - (100 / (1 + gain / loss))


def _atr(candles: list[Candle], period: int) -> float:
    if len(candles) <= period:
        return 0.0
    ranges: list[float] = []
    for previous, current in zip(candles[-period - 1:-1], candles[-period:]):
        ranges.append(max(
            current.high - current.low,
            abs(current.high - previous.close),
            abs(current.low - previous.close),
        ))
    return sum(ranges) / len(ranges) if ranges else 0.0


def _closed_candles(session, bot: TradingBot, settings: dict) -> list[Candle]:
    interval = settings["timeframe"]
    end_ms = int(utcnow().timestamp() * 1000) - _interval_seconds(interval) * 1000
    response = session.get_kline(
        category=bot.category,
        symbol=bot.symbol,
        interval=interval,
        end=end_ms,
        limit=min(settings["lookback_candles"], 1000),
    )
    candles: list[Candle] = []
    for row in response.get("result", {}).get("list", []):
        if not isinstance(row, (list, tuple)) or len(row) < 6:
            continue
        try:
            candles.append(Candle(int(row[0]), float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[5])))
        except (TypeError, ValueError):
            continue
    candles.sort(key=lambda item: item.open_time)
    return candles


def _signal(candles: list[Candle], settings: dict) -> Signal | None:
    required = max(
        settings["ema_slow_period"] + 3,
        settings["rsi_period"] + 2,
        settings["atr_period"] + 2,
        settings["breakout_lookback"] + 2,
        settings["volume_lookback"] + 2,
    )
    if len(candles) < required:
        return None
    closes = [item.close for item in candles]
    fast_values = _ema(closes, settings["ema_fast_period"])
    slow_values = _ema(closes, settings["ema_slow_period"])
    latest = candles[-1]
    atr = _atr(candles, settings["atr_period"])
    if atr <= 0:
        return None
    fast, fast_previous, slow = fast_values[-1], fast_values[-2], slow_values[-1]
    rsi = _rsi(closes, settings["rsi_period"])
    breakout = candles[-settings["breakout_lookback"] - 1:-1]
    previous_high = max(item.high for item in breakout)
    previous_low = min(item.low for item in breakout)
    volume_window = candles[-settings["volume_lookback"] - 1:-1]
    average_volume = sum(item.volume for item in volume_window) / len(volume_window)
    volume_ratio = latest.volume / average_volume if average_volume > 0 else 1.0
    body_atr = abs(latest.close - latest.open) / atr
    breakout_buffer = atr * max(_float(settings.get("breakout_buffer_atr"), 0.05), 0.0)

    long_trend = fast > slow and fast > fast_previous
    short_trend = fast < slow and fast < fast_previous
    long_breakout = latest.close > previous_high + breakout_buffer
    short_breakout = latest.close < previous_low - breakout_buffer
    volume_confirmed = volume_ratio >= _float(settings["volume_multiplier"], 3.0)
    long_rsi = _float(settings["rsi_long_min"], 50) <= rsi <= _float(settings["rsi_long_max"], 72)
    short_rsi = _float(settings["rsi_short_min"], 28) <= rsi <= _float(settings["rsi_short_max"], 50)
    minimum_body_atr = max(_float(settings.get("minimum_body_atr"), 0.25), 0.0)
    long_body = latest.close > latest.open and body_atr >= minimum_body_atr
    short_body = latest.close < latest.open and body_atr >= minimum_body_atr

    long_score, short_score = 0.0, 0.0
    long_reasons: list[str] = []
    short_reasons: list[str] = []
    if long_trend:
        long_score += 0.25; long_reasons.append("EMA trend is bullish")
    if long_breakout:
        long_score += 0.30; long_reasons.append("Closed above the recent high")
    if volume_confirmed:
        long_score += 0.20; long_reasons.append(f"Volume is {volume_ratio:.2f}× average")
    if long_rsi:
        long_score += 0.15; long_reasons.append(f"RSI confirms momentum ({rsi:.1f})")
    if long_body:
        long_score += 0.10; long_reasons.append("Bullish candle has meaningful range")

    if short_trend:
        short_score += 0.25; short_reasons.append("EMA trend is bearish")
    if short_breakout:
        short_score += 0.30; short_reasons.append("Closed below the recent low")
    if volume_confirmed:
        short_score += 0.20; short_reasons.append(f"Volume is {volume_ratio:.2f}× average")
    if short_rsi:
        short_score += 0.15; short_reasons.append(f"RSI confirms momentum ({rsi:.1f})")
    if short_body:
        short_score += 0.10; short_reasons.append("Bearish candle has meaningful range")

    require_trend = bool(settings.get("require_trend_confirmation", True))
    require_breakout = bool(settings.get("require_breakout_confirmation", True))
    require_volume = bool(settings.get("require_volume_confirmation", True))
    long_qualified = (not require_trend or long_trend) and (not require_breakout or long_breakout) and (not require_volume or volume_confirmed)
    short_qualified = (not require_trend or short_trend) and (not require_breakout or short_breakout) and (not require_volume or volume_confirmed)

    indicators = {
        "ema_fast": fast, "ema_slow": slow, "rsi": rsi, "atr": atr,
        "volume_ratio": volume_ratio, "body_atr": body_atr,
        "breakout_buffer": breakout_buffer,
        "previous_high": previous_high, "previous_low": previous_low,
    }
    minimum = _float(settings["minimum_signal_score"], 0.85)
    if long_qualified and long_score >= minimum and long_score >= short_score:
        return Signal("Buy", long_score, latest.close, atr, latest.open_time, long_reasons, indicators)
    if bool(settings.get("allow_short", True)) and short_qualified and short_score >= minimum:
        return Signal("Sell", short_score, latest.close, atr, latest.open_time, short_reasons, indicators)
    return None


def _position(session, bot: TradingBot) -> dict | None:
    for raw in get_open_positions(session, category=bot.category, symbol=bot.symbol):
        size = _float(raw.get("size") or raw.get("qty"))
        if size <= 0:
            continue
        side_value = str(raw.get("side") or raw.get("positionSide") or "Buy").lower()
        side = "Sell" if side_value in {"sell", "short"} else "Buy"
        return {
            "side": side,
            "size": size,
            "avg_entry_price": _float(raw.get("avgPrice") or raw.get("avgEntryPrice")),
            "raw": raw,
        }
    return None


def _record_order(db, bot: TradingBot, order: OrderRequest, response: dict, payload: dict | None = None) -> TradingBotOrder:
    result = response.get("result", {})
    record = TradingBotOrder(
        created_at=utcnow(), updated_at=utcnow(), bot_id=bot.id, user_id=bot.user_id,
        exchange=bot.exchange, environment=bot.environment, category=bot.category, symbol=bot.symbol,
        side=order.side, order_type=order.order_type, order_role=order.order_role,
        order_link_id=order.order_link_id, qty=order.qty, price=order.price,
        exchange_order_id=result.get("orderId"), status=result.get("orderStatus") or "New",
        parent_order_id=order.parent_order_id,
        raw_response={
            **dict(response or {}), "orderLinkId": order.order_link_id, "side": order.side,
            "orderType": order.order_type, "qty": str(order.qty),
            "price": str(order.price) if order.price is not None else None,
            "reduceOnly": order.reduce_only, "strategy": payload or {},
        },
    )
    db.add(record)
    db.flush()
    return record


def _latest_event(db, bot: TradingBot) -> TradingBotEvent | None:
    return db.query(TradingBotEvent).filter(TradingBotEvent.bot_id == bot.id).order_by(
        desc(TradingBotEvent.created_at), desc(TradingBotEvent.id)
    ).first()


def _wallet_balance(session) -> float | None:
    try:
        accounts = session.get_wallet_balance(accountType="UNIFIED").get("result", {}).get("list", [])
    except Exception:  # noqa: BLE001
        return None
    if not accounts:
        return None
    account = accounts[0]
    for key in ("totalEquity", "totalWalletBalance", "walletBalance"):
        value = _float(account.get(key), -1)
        if value >= 0:
            return value
    for coin in account.get("coin") or []:
        if str(coin.get("coin") or "").upper() == "USDT":
            value = _float(coin.get("equity") or coin.get("walletBalance"), -1)
            if value >= 0:
                return value
    return None


def _daily_pnl(session, bot: TradingBot) -> float:
    now = utcnow()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    executions: list[dict[str, Any]] = []
    cursor: str | None = None
    seen_cursors: set[str] = set()
    try:
        for _ in range(100):
            params: dict[str, Any] = {
                "category": bot.category, "symbol": bot.symbol,
                "startTime": int(start.timestamp() * 1000),
                "endTime": int(now.timestamp() * 1000), "limit": 100,
            }
            if cursor:
                params["cursor"] = cursor
            response = session.get_executions(**params)
            result = response.get("result", {})
            executions.extend(result.get("list", []) or [])
            next_cursor = str(result.get("nextPageCursor") or "")
            if not next_cursor or next_cursor in seen_cursors:
                break
            seen_cursors.add(next_cursor)
            cursor = next_cursor
    except Exception:  # noqa: BLE001
        return 0.0
    return sum(_float(item.get("closedPnl")) - _float(item.get("execFee")) for item in executions)


def _risk_reason(session, bot: TradingBot, settings: dict, price: float, qty: float) -> str | None:
    if qty <= 0:
        return "Calculated order quantity is zero"
    maximum = _float(settings.get("max_position_qty"), bot.order_qty)
    if maximum > 0 and qty > maximum + 1e-12:
        return "Max position quantity exceeded"
    max_notional = settings.get("max_notional_usdt")
    if max_notional is not None and qty * price > _float(max_notional):
        return "Max notional exposure exceeded"
    balance = _wallet_balance(session)
    daily_limit = _float(settings.get("max_daily_loss_percent"), 2)
    if balance and daily_limit > 0 and _daily_pnl(session, bot) <= -(balance * daily_limit / 100):
        return "Maximum daily loss reached"
    return None


def _entry_qty(session, bot: TradingBot, settings: dict, entry: float, stop: float) -> float:
    maximum = min(float(bot.order_qty), _float(settings.get("max_position_qty"), bot.order_qty))
    if str(settings.get("position_sizing") or "risk_capped") != "risk_capped":
        return maximum
    balance = _wallet_balance(session)
    distance = abs(entry - stop)
    if not balance or distance <= 0:
        return maximum
    budget = balance * _float(settings.get("risk_per_trade_percent"), 0.5) / 100
    return min(maximum, budget / distance)


def _levels(signal: Signal, settings: dict, entry: float) -> tuple[float, float]:
    stop_distance = signal.atr * _float(settings.get("stop_loss_atr"), 1.2)
    take_distance = signal.atr * _float(settings.get("take_profit_atr"), 1.8)
    return (entry - stop_distance, entry + take_distance) if signal.side == "Buy" else (entry + stop_distance, entry - take_distance)


def _parse_time(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        result = datetime.fromisoformat(str(value))
        return result if result.tzinfo else result.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _cooldown(bot: TradingBot, settings: dict, state: dict) -> bool:
    last_exit = _parse_time(state.get("last_exit_at"))
    return bool(last_exit and (utcnow() - last_exit).total_seconds() < _float(settings.get("cooldown_minutes"), 5) * 60)


def _should_tick(bot: TradingBot, settings: dict) -> bool:
    if bot.last_run_at is None:
        return True
    last_run = bot.last_run_at if bot.last_run_at.tzinfo else bot.last_run_at.replace(tzinfo=timezone.utc)
    return (utcnow() - last_run).total_seconds() >= _float(settings.get("run_interval_seconds"), 5)


def _close(db, bot: TradingBot, session, position: dict, role: str, reason: str, trade: dict | None) -> TradingBotOrder:
    now = utcnow()
    side = "Sell" if position["side"] == "Buy" else "Buy"
    rules = get_instrument_rules(session, category=bot.category, symbol=bot.symbol)
    request = normalize_order_request(OrderRequest(
        side=side, order_type="Market", order_role=role,
        order_link_id=f"{get_order_link_prefix(bot)}{role}-{int(now.timestamp() * 1000)}",
        qty=position["size"], price=None, reduce_only=True,
    ), rules)
    validation = validate_order_request(request, rules)
    if validation:
        raise ValueError(validation)
    response = place_order(session, category=bot.category, symbol=bot.symbol, order=request)
    _ensure_accepted(response, "Position close")
    record = _record_order(db, bot, request, response, {"exit_reason": reason, "trade": trade or {}})
    state = _state(bot)
    state["current_trade"] = trade or state.get("current_trade")
    state["pending_exit"] = {
        "order_link_id": request.order_link_id,
        "submitted_at": now.isoformat(),
        "reason": reason,
    }
    _save_state(db, bot, state)
    log_bot_event(db, bot, "scalper_exit_submitted", reason, {"side": side, "qty": request.qty, "role": role})
    return record


class PatternScalperStrategy:
    strategy_type = "pattern_scalper"

    def get_effective_settings(self, bot: TradingBot) -> dict:
        return _settings(bot)

    def validate_start(self, db, bot: TradingBot) -> None:
        if bot.category != "linear":
            raise ValueError("Pattern Scalper currently supports linear perpetuals only")
        message = ensure_live_trading_allowed(db, bot)
        if message:
            raise ValueError(message)
        settings = _settings(bot)
        if settings["ema_fast_period"] >= settings["ema_slow_period"]:
            raise ValueError("EMA fast period must be lower than EMA slow period")
        if _float(settings["stop_loss_atr"]) <= 0 or _float(settings["take_profit_atr"]) <= 0:
            raise ValueError("ATR stop-loss and take-profit multipliers must be greater than zero")
        if not 0 < _float(settings["minimum_signal_score"]) <= 1:
            raise ValueError("Minimum signal score must be between 0 and 1")
        if _float(settings["volume_multiplier"]) <= 0:
            raise ValueError("Volume multiplier must be greater than zero")
        if _float(settings.get("breakout_buffer_atr"), 0.0) < 0:
            raise ValueError("Breakout ATR buffer cannot be negative")

    def sync_orders(self, db, bot: TradingBot) -> list[TradingBotOrder]:
        return [change["order"] for change in sync_bot_orders(db, bot)]

    def cancel_orders(self, db, bot: TradingBot) -> list[TradingBotOrder]:
        return cancel_all_bot_orders(db, bot)

    def get_runtime_state(self, db, bot: TradingBot) -> tuple[str, str | None]:
        latest = _latest_event(db, bot)
        risk = latest.message if latest and latest.event_type == "risk_blocked" else None
        if bot.runtime_status != "running":
            return "stopped", risk
        if bot.last_error:
            return "error", risk
        session = get_bybit_session(bot)
        if _position(session, bot):
            return "position_open", risk
        settings = _settings(bot)
        if _cooldown(bot, settings, _state(bot)):
            return "cooldown", risk
        if risk:
            return "risk_blocked", risk
        return "waiting_for_signal", None

    def get_position(self, db, bot: TradingBot) -> dict:
        session = get_bybit_session(bot)
        ticker = get_ticker_snapshot(session, category=bot.category, symbol=bot.symbol)
        mark = _float(ticker.get("markPrice") or ticker.get("lastPrice"))
        position = _position(session, bot)
        if not position:
            return {"symbol": bot.symbol, "category": bot.category, "side": None, "size": "0", "avg_entry_price": None,
                    "mark_price": _fmt(mark), "liq_price": None, "unrealized_pnl": None, "unrealized_pnl_percent": None,
                    "leverage": None, "margin_mode": None, "position_value": None, "take_profit": None}
        raw, average, size = position["raw"], position["avg_entry_price"], position["size"]
        unrealized = _float(raw.get("unrealisedPnl") or raw.get("unrealizedPnl"))
        if not unrealized and mark and average:
            unrealized = ((mark - average) if position["side"] == "Buy" else (average - mark)) * size
        value = _float(raw.get("positionValue"), size * mark)
        trade = _state(bot).get("current_trade") or {}
        tp = None
        if trade.get("take_profit") is not None:
            tp = {"order_id": None, "order_link_id": trade.get("entry_order_link_id"), "price": _fmt(trade["take_profit"]),
                  "qty": _fmt(size), "status": "ManagedByStrategy", "reduce_only": True}
        return {"symbol": bot.symbol, "category": bot.category, "side": position["side"], "size": _fmt(size),
                "avg_entry_price": _fmt(average), "mark_price": _fmt(mark), "liq_price": _fmt(raw.get("liqPrice")),
                "unrealized_pnl": _fmt(unrealized), "unrealized_pnl_percent": _fmt(unrealized / value * 100 if value else None),
                "leverage": _fmt(raw.get("leverage")), "margin_mode": raw.get("tradeMode") or raw.get("marginMode"),
                "position_value": _fmt(value), "take_profit": tp}

    def get_risk(self, db, bot: TradingBot) -> dict:
        session = get_bybit_session(bot)
        settings = _settings(bot)
        position = _position(session, bot)
        current_qty = position["size"] if position else 0.0
        active = db.query(TradingBotOrder).filter(
            TradingBotOrder.bot_id == bot.id, TradingBotOrder.status.in_(ACTIVE_ORDER_STATUSES)
        ).all()
        pending = sum(order.qty for order in active if not bool((order.raw_response or {}).get("reduceOnly")))
        price = get_last_price(session, category=bot.category, symbol=bot.symbol)
        potential = current_qty + pending
        reason = _risk_reason(session, bot, settings, price, potential or bot.order_qty)
        if not reason and _cooldown(bot, settings, _state(bot)):
            reason = "Cooldown active"
        return {"max_position_qty": _fmt(settings["max_position_qty"]), "current_position_qty": _fmt(current_qty),
                "pending_buy_qty": _fmt(pending), "potential_total_qty": _fmt(potential),
                "max_open_orders": settings["max_open_orders"], "current_open_orders": len(active),
                "max_notional_usdt": _fmt(settings.get("max_notional_usdt")), "estimated_notional_usdt": _fmt(potential * price),
                "allow_live_trading": bool(settings.get("allow_live_trading", False)),
                "is_live_environment": str(bot.environment).lower() == "live",
                "blocked": bool(reason and reason != "Cooldown active"), "reason": reason}

    def close_position(self, db, bot: TradingBot) -> dict:
        session = get_bybit_session(bot)
        position = _position(session, bot)
        if not position:
            return {"message": "No open position to close", "order": None}
        order = _close(db, bot, session, position, "scalper_manual_close", "Manual position close requested", _state(bot).get("current_trade"))
        db.flush()
        return {"message": "Position close order submitted", "order": order}

    def tick(self, db, bot: TradingBot) -> dict:
        settings = _settings(bot)
        if bot.runtime_status != "running":
            return {"orders": [], "events": 0, "message": "Bot is not running"}
        if not bot.is_active:
            bot.runtime_status = "stopped"; bot.last_error = "Bot is inactive"
            log_bot_event(db, bot, "error", bot.last_error); db.add(bot); db.commit()
            return {"orders": [], "events": 1, "message": bot.last_error}
        if not _should_tick(bot, settings):
            return {"orders": [], "events": 0, "message": "Tick skipped by interval"}
        live_message = ensure_live_trading_allowed(db, bot)
        if live_message:
            bot.last_run_at = utcnow(); db.add(bot); db.commit()
            return {"orders": [], "events": 1, "message": live_message}

        try:
            synced = sync_bot_orders(db, bot)
            session = get_bybit_session(bot)
            position = _position(session, bot)
            state = _state(bot)
            trade = dict(state.get("current_trade") or {})
            created: list[TradingBotOrder] = []

            pending_exit = dict(state.get("pending_exit") or {})
            if not position and trade:
                opened_at = _parse_time(trade.get("opened_at"))
                entry_is_settling = not pending_exit and opened_at is not None and (utcnow() - opened_at).total_seconds() < 30
                if not entry_is_settling:
                    state["current_trade"] = None
                    state["pending_exit"] = None
                    state["last_exit_at"] = utcnow().isoformat()
                    _save_state(db, bot, state)
                    log_bot_event(db, bot, "scalper_position_closed", "Scalper position is closed", {"entry_order_link_id": trade.get("entry_order_link_id")})
                    trade = {}
                    pending_exit = {}
            elif not position and pending_exit:
                state["pending_exit"] = None
                _save_state(db, bot, state)
                pending_exit = {}

            current_price = get_last_price(session, category=bot.category, symbol=bot.symbol)
            if position:
                exit_is_settling = False
                if pending_exit:
                    submitted_at = _parse_time(pending_exit.get("submitted_at"))
                    exit_is_settling = submitted_at is not None and (utcnow() - submitted_at).total_seconds() < 60
                    if not exit_is_settling:
                        state["pending_exit"] = None
                        _save_state(db, bot, state)
                        pending_exit = {}
                if not trade:
                    candles = _closed_candles(session, bot, settings)
                    atr = _atr(candles, settings["atr_period"])
                    recovery = Signal(position["side"], 0, position["avg_entry_price"], atr, candles[-1].open_time if candles else 0, ["Recovered open position"], {"atr": atr})
                    stop, take = _levels(recovery, settings, position["avg_entry_price"])
                    trade = {"side": position["side"], "entry_price": position["avg_entry_price"], "stop_loss": stop,
                             "take_profit": take, "opened_at": utcnow().isoformat(), "recovered": True}
                    state["current_trade"] = trade; _save_state(db, bot, state)
                opened = _parse_time(trade.get("opened_at")) or utcnow()
                held = max((utcnow() - opened).total_seconds(), 0)
                stop, take = _float(trade.get("stop_loss")), _float(trade.get("take_profit"))
                role = reason = None
                if position["side"] == "Buy" and stop and current_price <= stop: role, reason = "scalper_stop_loss", "Long stop-loss reached"
                elif position["side"] == "Buy" and take and current_price >= take: role, reason = "scalper_take_profit", "Long take-profit reached"
                elif position["side"] == "Sell" and stop and current_price >= stop: role, reason = "scalper_stop_loss", "Short stop-loss reached"
                elif position["side"] == "Sell" and take and current_price <= take: role, reason = "scalper_take_profit", "Short take-profit reached"
                elif held >= _float(settings.get("max_holding_minutes"), 30) * 60: role, reason = "scalper_timeout", "Maximum holding time reached"
                if role and not exit_is_settling:
                    created.append(_close(db, bot, session, position, role, reason, trade))
            elif not trade:
                active_entries = [order for order in db.query(TradingBotOrder).filter(
                    TradingBotOrder.bot_id == bot.id, TradingBotOrder.status.in_(ACTIVE_ORDER_STATUSES)
                ).all() if not bool((order.raw_response or {}).get("reduceOnly"))]
                if not active_entries and not _cooldown(bot, settings, state):
                    signal = _signal(_closed_candles(session, bot, settings), settings)
                    if signal and signal.candle_time != state.get("last_signal_candle"):
                        state["last_signal_candle"] = signal.candle_time
                        _save_state(db, bot, state)
                        stop, take = _levels(signal, settings, current_price)
                        rules = get_instrument_rules(session, category=bot.category, symbol=bot.symbol)
                        request = normalize_order_request(OrderRequest(
                            side=signal.side, order_type="Market",
                            order_role="scalper_entry_long" if signal.side == "Buy" else "scalper_entry_short",
                            order_link_id=f"{get_order_link_prefix(bot)}scalper-entry-{signal.side.lower()}-{signal.candle_time}",
                            qty=_entry_qty(session, bot, settings, current_price, stop), price=None, reduce_only=False,
                        ), rules)
                        risk = _risk_reason(session, bot, settings, current_price, request.qty)
                        validation = validate_order_request(request, rules)
                        notional = request.qty * current_price
                        if not validation and rules.min_notional_value > 0 and notional + 1e-12 < rules.min_notional_value:
                            validation = f"Order notional {notional:.8f} is below Bybit minimum {rules.min_notional_value}"
                        if risk or validation:
                            message = risk or validation or "Entry blocked"
                            log_bot_event(db, bot, "risk_blocked", message, {"side": signal.side, "score": signal.score, "qty": request.qty, "price": current_price})
                        else:
                            response = place_order(session, category=bot.category, symbol=bot.symbol, order=request)
                            _ensure_accepted(response, "Scalper entry")
                            payload = {"signal_score": signal.score, "signal_reasons": signal.reasons, "indicators": signal.indicators,
                                       "signal_candle_time": signal.candle_time, "entry_price": current_price, "stop_loss": stop, "take_profit": take}
                            created.append(_record_order(db, bot, request, response, payload))
                            state["current_trade"] = {"side": signal.side, "entry_price": current_price, "stop_loss": stop,
                                                      "take_profit": take, "opened_at": utcnow().isoformat(),
                                                      "entry_order_link_id": request.order_link_id, "signal_score": signal.score,
                                                      "signal_reasons": signal.reasons, "indicators": signal.indicators}
                            _save_state(db, bot, state)
                            log_bot_event(db, bot, "scalper_signal_entered", "Pattern scalper opened a position", {
                                "side": signal.side, "score": signal.score, "reasons": signal.reasons,
                                "entry_price": current_price, "stop_loss": stop, "take_profit": take,
                                "qty": request.qty, "order_link_id": request.order_link_id,
                            })

            bot.last_run_at = utcnow(); bot.last_error = None; db.add(bot); db.commit()
            return {"orders": [change["order"] for change in synced] + created, "events": len(synced), "message": "Pattern scalper tick completed"}
        except Exception as exc:  # noqa: BLE001
            bot.last_run_at = utcnow(); bot.last_error = str(exc)
            if bool(settings.get("stop_bot_on_error", True)):
                bot.runtime_status = "stopped"
            log_bot_event(db, bot, "error", str(exc)); db.add(bot); db.commit()
            return {"orders": [], "events": 1, "message": str(exc)}
