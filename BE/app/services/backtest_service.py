"""Emulator-driven backtest orchestration for existing trading bots."""
from __future__ import annotations

import math
from decimal import Decimal, ROUND_CEILING
import statistics
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import asc, desc, delete
from sqlalchemy.orm import Session

from app.bot_engine.grid_runtime import close_bot_position, tick_grid_bot
from app.core.clock import use_simulated_time
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.backtest import BacktestCycle, BacktestPoint, BacktestRun
from app.models.trading_bot import TradingBot
from app.models.trading_bot_event import TradingBotEvent
from app.models.trading_bot_order import TradingBotOrder
from app.schemas.backtest import BacktestCreate
from app.services.backtest_emulator import BacktestEmulatorClient

ACTIVE_STATUSES = {"queued", "running", "paused"}
FINAL_STATUSES = {"completed", "failed", "cancelled"}
MAX_CHART_POINTS = 1800


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _interval_seconds(interval: str) -> int:
    mapping = {
        "1": 60, "3": 180, "5": 300, "15": 900, "30": 1800,
        "60": 3600, "120": 7200, "240": 14400, "360": 21600,
        "720": 43200, "D": 86400, "W": 604800, "M": 2592000,
    }
    return mapping.get(str(interval), 60)




def _ceil_to_step(value: float, step: float) -> float:
    if step <= 0:
        return value
    value_decimal = Decimal(str(value))
    step_decimal = Decimal(str(step))
    units = (value_decimal / step_decimal).quantize(Decimal("1"), rounding=ROUND_CEILING)
    return float(units * step_decimal)


def _validate_initial_grid_quantity(
    bot: TradingBot,
    *,
    first_price: float,
    instrument_response: dict[str, Any],
) -> None:
    items = instrument_response.get("result", {}).get("list", [])
    if not items:
        raise ValueError(f"Instrument rules were not found for {bot.symbol}")

    lot = items[0].get("lotSizeFilter", {})
    min_order_qty = _float(lot.get("minOrderQty"))
    qty_step = _float(lot.get("qtyStep"), 0.000001)
    min_notional = _float(lot.get("minNotionalValue"))

    levels = max(int(bot.grid_orders_count or 1), 1)
    step_percent = max(_float(bot.grid_step_percent), 0.0)
    lowest_multiplier = 1.0 - ((levels - 1) * step_percent / 100.0)
    lowest_grid_price = first_price * lowest_multiplier
    if lowest_grid_price <= 0:
        raise ValueError("Grid configuration produces a non-positive order price")

    required_for_notional = min_notional / lowest_grid_price if min_notional > 0 else 0.0
    minimum_qty = _ceil_to_step(max(min_order_qty, required_for_notional), qty_step)
    configured_qty = _float(bot.order_qty)

    if configured_qty + 1e-12 < minimum_qty:
        coin = bot.symbol.removesuffix("USDT")
        raise ValueError(
            f"Order quantity is too small for this backtest. "
            f"Configured: {configured_qty:g} {coin}. "
            f"Minimum for all {levels} grid levels at the starting price is "
            f"{minimum_qty:g} {coin} (Bybit minimum notional: {min_notional:g} USDT). "
            f"Increase the bot Order quantity to at least {minimum_qty:g} {coin} and try again."
        )


def _bot_snapshot(bot: TradingBot) -> dict[str, Any]:
    return {
        "id": bot.id,
        "name": bot.name,
        "exchange": bot.exchange,
        "environment": bot.environment,
        "strategy_type": bot.strategy_type,
        "category": bot.category,
        "symbol": bot.symbol,
        "order_qty": bot.order_qty,
        "grid_orders_count": bot.grid_orders_count,
        "grid_step_percent": bot.grid_step_percent,
        "is_active": bot.is_active,
        "settings": dict(bot.settings or {}),
    }


def list_backtests(db: Session, user_id: int, limit: int = 100) -> list[BacktestRun]:
    return (
        db.query(BacktestRun)
        .filter(BacktestRun.user_id == user_id)
        .order_by(desc(BacktestRun.created_at), desc(BacktestRun.id))
        .limit(limit)
        .all()
    )


def get_backtest_by_id(db: Session, run_id: int, user_id: int) -> BacktestRun | None:
    return db.query(BacktestRun).filter(BacktestRun.id == run_id, BacktestRun.user_id == user_id).first()


def create_backtest(db: Session, payload: BacktestCreate, user_id: int) -> BacktestRun:
    if payload.end_time <= payload.start_time:
        raise ValueError("Backtest end time must be greater than start time")
    bot = (
        db.query(TradingBot)
        .filter(
            TradingBot.id == payload.bot_id,
            TradingBot.user_id == user_id,
            TradingBot.is_backtest.is_(False),
        )
        .first()
    )
    if bot is None:
        raise ValueError("Trading bot not found")
    if bot.strategy_type != "grid":
        raise ValueError("Only grid bots are supported by the current backtest runner")

    settings = get_settings()
    emulator = BacktestEmulatorClient(settings.exchange_emulator_url)
    try:
        candle_count = emulator.candle_count(
            symbol=bot.symbol,
            interval=payload.interval,
            start_time=payload.start_time,
            end_time=payload.end_time,
        )
        if candle_count <= 0:
            raise ValueError("No historical candles found for this bot, interval, and period")

        first_candle = emulator.first_candle(
            symbol=bot.symbol,
            interval=payload.interval,
            start_time=payload.start_time,
            end_time=payload.end_time,
        )
        if first_candle is None:
            raise ValueError("No historical candles found for this bot, interval, and period")

        instrument_response = emulator.instrument_info(category=bot.category, symbol=bot.symbol)
        _validate_initial_grid_quantity(
            bot,
            first_price=_float(first_candle.get("open")),
            instrument_response=instrument_response,
        )
    finally:
        emulator.close()

    snapshot = _bot_snapshot(bot)
    name = payload.name or f"{bot.name} · {datetime.fromtimestamp(payload.start_time / 1000, tz=timezone.utc).date()}"
    run = BacktestRun(
        user_id=user_id,
        source_bot_id=bot.id,
        name=name,
        bot_name=bot.name,
        symbol=bot.symbol,
        interval=payload.interval,
        start_time=payload.start_time,
        end_time=payload.end_time,
        initial_balance=payload.initial_balance,
        fee_rate=payload.fee_rate,
        slippage_percent=payload.slippage_percent,
        path_mode=payload.path_mode,
        end_behavior=payload.end_behavior,
        status="queued",
        total_candles=candle_count,
        bot_snapshot=snapshot,
        configuration={
            "dataset": {"symbol": bot.symbol, "interval": payload.interval},
            "start_time": payload.start_time,
            "end_time": payload.end_time,
            "initial_balance": payload.initial_balance,
            "fee_rate": payload.fee_rate,
            "slippage_percent": payload.slippage_percent,
            "path_mode": payload.path_mode,
            "end_behavior": payload.end_behavior,
            "application_version": "1.0.0",
        },
        metrics={},
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def request_pause(db: Session, run: BacktestRun) -> BacktestRun:
    if run.status not in {"queued", "running"}:
        raise ValueError("Only a queued or running backtest can be paused")
    run.pause_requested = True
    db.commit()
    db.refresh(run)
    return run


def request_resume(db: Session, run: BacktestRun) -> BacktestRun:
    if run.status not in {"paused", "running"}:
        raise ValueError("Only a paused backtest can be resumed")
    run.pause_requested = False
    if run.status == "paused":
        run.status = "running"
    db.commit()
    db.refresh(run)
    return run


def request_cancel(db: Session, run: BacktestRun) -> BacktestRun:
    if run.status in FINAL_STATUSES:
        return run
    run.cancel_requested = True
    db.commit()
    db.refresh(run)
    return run


def delete_backtest(db: Session, run: BacktestRun) -> None:
    if run.status in {"queued", "running", "paused"}:
        raise ValueError("Cancel the running backtest before deleting it")
    account_id = run.emulator_account_id
    # Delete the hidden bot explicitly as well as relying on the database FK.
    # This keeps SQLite development databases clean even when FK enforcement is off.
    if run.temp_bot_id:
        temp_bot = db.get(TradingBot, run.temp_bot_id)
        if temp_bot is not None:
            db.delete(temp_bot)
            db.flush()
    db.delete(run)
    db.commit()
    if account_id:
        emulator = BacktestEmulatorClient(get_settings().exchange_emulator_url)
        try:
            emulator.delete_account(account_id)
        except Exception:
            pass
        finally:
            emulator.close()


def list_points(db: Session, run_id: int) -> list[BacktestPoint]:
    return db.query(BacktestPoint).filter(BacktestPoint.run_id == run_id).order_by(asc(BacktestPoint.timestamp)).all()


def list_cycles(db: Session, run_id: int) -> list[BacktestCycle]:
    return db.query(BacktestCycle).filter(BacktestCycle.run_id == run_id).order_by(BacktestCycle.cycle_number).all()


def list_orders(db: Session, run: BacktestRun) -> list[TradingBotOrder]:
    if not run.temp_bot_id:
        return []
    return (
        db.query(TradingBotOrder)
        .filter(TradingBotOrder.bot_id == run.temp_bot_id)
        .order_by(asc(TradingBotOrder.created_at), asc(TradingBotOrder.id))
        .all()
    )


def list_events(db: Session, run: BacktestRun, limit: int = 5000) -> list[TradingBotEvent]:
    if not run.temp_bot_id:
        return []
    return (
        db.query(TradingBotEvent)
        .filter(TradingBotEvent.bot_id == run.temp_bot_id)
        .order_by(asc(TradingBotEvent.created_at), asc(TradingBotEvent.id))
        .limit(limit)
        .all()
    )


def list_executions(run: BacktestRun) -> list[dict]:
    if not run.emulator_account_id:
        return []
    emulator = BacktestEmulatorClient(get_settings().exchange_emulator_url)
    try:
        return _sorted_executions(emulator.executions(run.emulator_account_id, run.symbol, limit=100000))
    finally:
        emulator.close()


def list_datasets() -> list[dict]:
    emulator = BacktestEmulatorClient(get_settings().exchange_emulator_url)
    try:
        return emulator.datasets()
    finally:
        emulator.close()



def _execution_sort_key(item: dict[str, Any]) -> tuple[int, int, str]:
    """Chronological execution order with exits before new entries at the same tick.

    The emulator can fill an old position TP and immediately create/fill the next
    grid entry at the same simulated timestamp.  Sorting only by timestamp loses
    that causal order and makes the UI reconstruct 0.003 -> 0.006 -> 0.003 instead
    of 0.003 -> 0 -> 0.003.
    """
    side = str(item.get("side") or "").lower()
    priority = 0 if side == "sell" else 1
    return int(item.get("execTime") or 0), priority, str(item.get("execId") or "")


def _sorted_executions(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(items, key=_execution_sort_key)


def _rebuild_cycles_from_executions(
    db: Session,
    run: BacktestRun,
    executions: list[dict[str, Any]],
) -> list[BacktestCycle]:
    """Rebuild cycle records from actual fills instead of end-of-tick snapshots.

    A TP fill may flatten the position and the next grid entry may reopen it in the
    same simulated timestamp. Dashboard snapshots only see the final open position,
    so cycle boundaries must be derived from executions themselves.
    """
    db.execute(delete(BacktestCycle).where(BacktestCycle.run_id == run.id))
    db.flush()

    order_roles = {
        str(exchange_id): str(role or "")
        for exchange_id, role in db.query(
            TradingBotOrder.exchange_order_id,
            TradingBotOrder.order_role,
        ).filter(
            TradingBotOrder.bot_id == run.temp_bot_id,
            TradingBotOrder.exchange_order_id.is_not(None),
        ).all()
    }

    cycles: list[BacktestCycle] = []
    current: dict[str, Any] | None = None
    qty = 0.0
    avg = 0.0
    cycle_number = 0

    for item in _sorted_executions(executions):
        ts = int(item.get("execTime") or 0)
        side = str(item.get("side") or "").lower()
        fill_qty = _float(item.get("execQty"))
        price = _float(item.get("execPrice"))
        fee = _float(item.get("execFee"))
        closed_pnl = _float(item.get("closedPnl"))
        role = order_roles.get(str(item.get("orderId") or ""), "")

        if side == "buy":
            if qty <= 1e-12:
                cycle_number += 1
                current = {
                    "number": cycle_number,
                    "started_at": ts,
                    "last_time": ts,
                    "entries": 0,
                    "max_qty": 0.0,
                    "max_value": 0.0,
                    "avg_entry": 0.0,
                    "gross": 0.0,
                    "fees": 0.0,
                }
            before = qty
            qty += fill_qty
            avg = (((before * avg) + (fill_qty * price)) / qty) if qty > 0 else 0.0
            if current is not None:
                current["last_time"] = ts
                current["entries"] += 1 if role == "grid_entry" or not role else 0
                current["max_qty"] = max(current["max_qty"], qty)
                current["max_value"] = max(current["max_value"], qty * price)
                current["avg_entry"] = avg
                current["fees"] += fee
            continue

        if side != "sell":
            continue

        if current is None and qty > 1e-12:
            cycle_number += 1
            current = {
                "number": cycle_number,
                "started_at": ts,
                "last_time": ts,
                "entries": 0,
                "max_qty": qty,
                "max_value": qty * price,
                "avg_entry": avg,
                "gross": 0.0,
                "fees": 0.0,
            }

        close_qty = min(fill_qty, qty)
        qty = max(qty - close_qty, 0.0)
        if current is not None:
            current["last_time"] = ts
            current["gross"] += closed_pnl
            current["fees"] += fee

        if qty <= 1e-12:
            qty = 0.0
            avg = 0.0
            if current is not None:
                duration = max((ts - current["started_at"]) / 1000, 0.0)
                cycle = BacktestCycle(
                    run_id=run.id,
                    cycle_number=current["number"],
                    started_at_ms=current["started_at"],
                    closed_at_ms=ts,
                    duration_seconds=duration,
                    time_in_loss_seconds=0.0,
                    max_unrealized_loss=0.0,
                    max_position_qty=current["max_qty"],
                    max_position_value=current["max_value"],
                    entries_filled=current["entries"],
                    avg_entry_price=current["avg_entry"] or None,
                    exit_price=price,
                    gross_pnl=current["gross"],
                    fees=current["fees"],
                    net_pnl=current["gross"] - current["fees"],
                    status="closed",
                    details={"derived_from": "executions"},
                )
                db.add(cycle)
                cycles.append(cycle)
                current = None

    if current is not None:
        duration = max((run.end_time - current["started_at"]) / 1000, 0.0)
        cycle = BacktestCycle(
            run_id=run.id,
            cycle_number=current["number"],
            started_at_ms=current["started_at"],
            closed_at_ms=None,
            duration_seconds=duration,
            time_in_loss_seconds=0.0,
            max_unrealized_loss=0.0,
            max_position_qty=max(current["max_qty"], qty),
            max_position_value=current["max_value"],
            entries_filled=current["entries"],
            avg_entry_price=avg or current["avg_entry"] or None,
            exit_price=None,
            gross_pnl=current["gross"],
            fees=current["fees"],
            net_pnl=current["gross"] - current["fees"],
            status="open",
            details={"derived_from": "executions"},
        )
        db.add(cycle)
        cycles.append(cycle)

    db.flush()

    # Enrich exposure/loss metrics from stored chart snapshots. Execution-derived
    # boundaries remain authoritative; points only provide between-fill market state.
    points = (
        db.query(BacktestPoint)
        .filter(BacktestPoint.run_id == run.id)
        .order_by(asc(BacktestPoint.timestamp))
        .all()
    )
    for cycle in cycles:
        cycle_end = cycle.closed_at_ms if cycle.closed_at_ms is not None else run.end_time
        cycle_points = [
            point for point in points
            if cycle.started_at_ms <= point.timestamp <= cycle_end
        ]
        if cycle_points:
            cycle.max_unrealized_loss = min(
                [0.0, *(_float(point.unrealized_pnl) for point in cycle_points)]
            )
            cycle.max_position_qty = max(
                [cycle.max_position_qty, *(_float(point.position_qty) for point in cycle_points)]
            )
            cycle.max_position_value = max(
                [cycle.max_position_value, *(_float(point.position_value) for point in cycle_points)]
            )
            loss_seconds = 0.0
            for index, point in enumerate(cycle_points):
                next_time = (
                    cycle_points[index + 1].timestamp
                    if index + 1 < len(cycle_points)
                    else cycle_end
                )
                if point.position_qty > 0 and point.unrealized_pnl < 0:
                    loss_seconds += max((next_time - point.timestamp) / 1000, 0.0)
            cycle.time_in_loss_seconds = min(loss_seconds, cycle.duration_seconds)
        db.add(cycle)

    db.flush()
    return cycles

def _path_for_candle(candle: dict, path_mode: str) -> list[float]:
    # For a long grid strategy, high-before-low is the conservative ambiguous-candle path:
    # lower entries filled later cannot unrealistically close at an earlier high in the same candle.
    if path_mode in {"conservative", "ohlc"}:
        return [candle["open"], candle["high"], candle["low"], candle["close"]]
    if path_mode == "olhc":
        return [candle["open"], candle["low"], candle["high"], candle["close"]]
    return [candle["close"]]


def _local_signature(db: Session, bot_id: int) -> tuple:
    orders = (
        db.query(TradingBotOrder.id, TradingBotOrder.status, TradingBotOrder.updated_at)
        .filter(TradingBotOrder.bot_id == bot_id)
        .order_by(TradingBotOrder.id)
        .all()
    )
    events_count = db.query(TradingBotEvent).filter(TradingBotEvent.bot_id == bot_id).count()
    return tuple((row.id, row.status, str(row.updated_at)) for row in orders), events_count


def _tick_until_stable(db: Session, bot: TradingBot, max_ticks: int = 7) -> None:
    previous = None
    for _ in range(max_ticks):
        tick_grid_bot(db, bot)
        db.refresh(bot)
        if bot.last_error:
            raise RuntimeError(bot.last_error)
        current = _local_signature(db, bot.id)
        if current == previous:
            return
        previous = current


def _assert_initial_grid_created(db: Session, bot: TradingBot) -> None:
    """Fail a backtest when its initial grid cannot create any order.

    Order validation in the shared live runtime is intentionally recoverable and is
    recorded as bot events. During a historical backtest, however, retrying the
    same invalid configuration on every candle produces thousands of duplicate
    errors and a misleading Completed result.
    """
    active_orders = (
        db.query(TradingBotOrder.id)
        .filter(
            TradingBotOrder.bot_id == bot.id,
            TradingBotOrder.status.in_({"New", "PartiallyFilled", "Untriggered"}),
        )
        .count()
    )
    if active_orders > 0:
        return

    error_events = (
        db.query(TradingBotEvent)
        .filter(
            TradingBotEvent.bot_id == bot.id,
            TradingBotEvent.event_type == "error",
        )
        .order_by(asc(TradingBotEvent.id))
        .all()
    )
    if not error_events:
        return

    unique_messages: list[str] = []
    for event in error_events:
        message = str(event.message or "Backtest bot failed to create its initial grid")
        if message not in unique_messages:
            unique_messages.append(message)

    details = "; ".join(unique_messages[:5])
    if len(unique_messages) > 5:
        details += f"; and {len(unique_messages) - 5} more errors"
    raise RuntimeError(f"Initial grid creation failed: {details}")


def _dashboard_values(payload: dict) -> dict[str, float]:
    account = payload.get("account") or {}
    position = payload.get("position") or {}
    return {
        "balance": _float(account.get("balance")),
        "equity": _float(account.get("equity")),
        "available": _float(account.get("available_balance")),
        "unrealized": _float(account.get("unrealized_pnl")),
        "position_qty": _float(position.get("size")),
        "position_value": _float(position.get("positionValue")),
        "margin_used": _float(account.get("margin_used")),
        "avg_entry": _float(position.get("avgPrice")),
        "mark_price": _float(position.get("markPrice")),
    }


def _store_cycle(db: Session, run_id: int, state: dict, *, close_time: int | None, exit_price: float | None, balance: float) -> BacktestCycle:
    duration = max(((close_time or state["last_time"]) - state["started_at"]) / 1000, 0)
    net_pnl = balance - state["start_balance"] if close_time is not None else 0.0
    cycle = BacktestCycle(
        run_id=run_id,
        cycle_number=state["number"],
        started_at_ms=state["started_at"],
        closed_at_ms=close_time,
        duration_seconds=duration,
        time_in_loss_seconds=state["time_in_loss"],
        max_unrealized_loss=state["max_unrealized_loss"],
        max_position_qty=state["max_qty"],
        max_position_value=state["max_value"],
        entries_filled=state["entries_filled"],
        avg_entry_price=state.get("avg_entry"),
        exit_price=exit_price,
        gross_pnl=net_pnl,
        fees=0,
        net_pnl=net_pnl,
        status="closed" if close_time is not None else "open",
        details={"start_balance": state["start_balance"]},
    )
    db.add(cycle)
    db.flush()
    return cycle


def _final_metrics(
    run: BacktestRun,
    dashboard: dict,
    executions: list[dict],
    state: dict,
    cycles: list[BacktestCycle],
) -> dict[str, Any]:
    values = _dashboard_values(dashboard)
    fees = sum(_float(item.get("execFee")) for item in executions)
    gross_realized = sum(_float(item.get("closedPnl")) for item in executions)
    net_realized = values["balance"] - run.initial_balance
    total_pnl = values["equity"] - run.initial_balance
    closed = [cycle for cycle in cycles if cycle.status == "closed"]
    winning = [cycle for cycle in closed if cycle.net_pnl > 0]
    durations = [cycle.duration_seconds for cycle in closed]
    period_seconds = max((run.end_time - run.start_time) / 1000, 1)
    return {
        "initial_balance": run.initial_balance,
        "final_balance": values["balance"],
        "final_equity": values["equity"],
        "gross_realized_pnl": gross_realized,
        "net_realized_pnl": net_realized,
        "unrealized_pnl": values["unrealized"],
        "net_total_pnl": total_pnl,
        "return_percent": (total_pnl / run.initial_balance) * 100,
        "total_fees": fees,
        "closed_cycles": len(closed),
        "winning_cycles": len(winning),
        "losing_cycles": len(closed) - len(winning),
        "win_rate_percent": (len(winning) / len(closed) * 100) if closed else 0,
        "average_cycle_pnl": (sum(c.net_pnl for c in closed) / len(closed)) if closed else 0,
        "best_cycle_pnl": max((c.net_pnl for c in closed), default=0),
        "worst_cycle_pnl": min((c.net_pnl for c in closed), default=0),
        "average_cycle_duration_seconds": (sum(durations) / len(durations)) if durations else 0,
        "median_cycle_duration_seconds": statistics.median(durations) if durations else 0,
        "longest_cycle_seconds": max(durations, default=0),
        "time_in_position_seconds": state["time_in_position"],
        "time_in_position_percent": state["time_in_position"] / period_seconds * 100,
        "time_in_loss_seconds": state["time_in_loss"],
        "time_in_loss_percent": state["time_in_loss"] / period_seconds * 100,
        "longest_negative_pnl_period_seconds": state["longest_loss"],
        "maximum_unrealized_loss": state["max_unrealized_loss"],
        "maximum_drawdown_percent": state["max_drawdown"],
        "longest_drawdown_seconds": state["longest_drawdown"],
        "maximum_drawdown_recovery_seconds": state["max_drawdown_recovery"],
        "maximum_drawdown_recovered": state["max_drawdown_recovered"],
        "current_drawdown_recovery_seconds": state["current_drawdown_recovery"],
        "current_drawdown_percent": state["current_drawdown"],
        "maximum_position_qty": state["max_position_qty"],
        "maximum_position_value": state["max_position_value"],
        "maximum_used_margin": state["max_margin_used"],
        "lowest_available_balance": state["lowest_available"],
        "maximum_grid_levels_filled": max((cycle.entries_filled for cycle in cycles), default=0),
        "open_position_at_end": values["position_qty"] > 0,
        "open_position_qty": values["position_qty"],
        "open_position_value": values["position_value"],
        "open_avg_entry_price": values["avg_entry"] or None,
        "open_orders_at_end": int(dashboard.get("open_orders") or 0),
        "executions_count": len(executions),
        "candles_processed": run.processed_candles,
        "execution_duration_seconds": max(
            (
                _utcnow()
                - (run.started_at if run.started_at and run.started_at.tzinfo else run.started_at.replace(tzinfo=timezone.utc))
            ).total_seconds() if run.started_at else 0,
            0,
        ),
    }


def run_backtest_job(run_id: int) -> None:
    db = SessionLocal()
    emulator = BacktestEmulatorClient(get_settings().exchange_emulator_url, timeout=60)
    run: BacktestRun | None = None
    temp_bot: TradingBot | None = None
    try:
        run = db.get(BacktestRun, run_id)
        if run is None or run.status != "queued":
            return
        run.status = "running"
        run.started_at = _utcnow()
        run.error = None
        db.commit()

        account = emulator.create_account(
            f"Backtest #{run.id} · {run.bot_name}",
            run.initial_balance,
            fee_rate=run.fee_rate,
            slippage_percent=run.slippage_percent,
        )
        run.emulator_account_id = int(account["id"])
        snapshot = dict(run.bot_snapshot)
        bot_settings = dict(snapshot.get("settings") or {})
        bot_settings.update({
            "emulator_api_key": account["api_key"],
            "run_interval_seconds": 0,
            "stop_bot_on_error": True,
        })
        temp_bot = TradingBot(
            user_id=run.user_id,
            name=f"[Backtest #{run.id}] {run.bot_name}",
            exchange="bybit",
            environment="emulator",
            strategy_type=snapshot.get("strategy_type", "grid"),
            category=snapshot.get("category", "linear"),
            symbol=run.symbol,
            order_qty=_float(snapshot.get("order_qty"), 0.001),
            grid_orders_count=int(snapshot.get("grid_orders_count") or 2),
            grid_step_percent=_float(snapshot.get("grid_step_percent"), 5),
            is_active=True,
            runtime_status="running",
            settings=bot_settings,
            is_backtest=True,
            backtest_run_id=run.id,
            started_at=_utcnow(),
        )
        db.add(temp_bot)
        db.flush()
        run.temp_bot_id = temp_bot.id
        db.commit()

        interval_seconds = _interval_seconds(run.interval)
        sample_every = max(math.ceil(run.total_candles / MAX_CHART_POINTS), 1)
        state: dict[str, Any] = {
            "peak_equity": run.initial_balance,
            "max_drawdown": 0.0,
            "current_drawdown": 0.0,
            "drawdown_started": None,
            "longest_drawdown": 0.0,
            "deepest_drawdown_time": None,
            "max_drawdown_recovery": 0.0,
            "max_drawdown_recovered": False,
            "current_drawdown_recovery": 0.0,
            "time_in_position": 0.0,
            "time_in_loss": 0.0,
            "loss_started": None,
            "longest_loss": 0.0,
            "max_unrealized_loss": 0.0,
            "max_position_qty": 0.0,
            "max_position_value": 0.0,
            "max_margin_used": 0.0,
            "lowest_available": run.initial_balance,
            "previous_time": None,
            "previous_values": None,
            "current_cycle": None,
            "cycle_number": 0,
            "filled_buy_count": 0,
        }

        for index, candle in enumerate(
            emulator.candles(
                symbol=run.symbol,
                interval=run.interval,
                start_time=run.start_time,
                end_time=run.end_time,
            ),
            start=1,
        ):
            db.expire(run)
            db.refresh(run)
            if run.cancel_requested:
                run.status = "cancelled"
                run.completed_at = _utcnow()
                temp_bot.runtime_status = "stopped"
                temp_bot.stopped_at = _utcnow()
                db.add_all([run, temp_bot])
                db.commit()
                return
            while run.pause_requested:
                run.status = "paused"
                db.commit()
                time.sleep(0.4)
                db.expire(run)
                db.refresh(run)
                if run.cancel_requested:
                    run.status = "cancelled"
                    run.completed_at = _utcnow()
                    temp_bot.runtime_status = "stopped"
                    temp_bot.stopped_at = _utcnow()
                    db.add_all([run, temp_bot])
                    db.commit()
                    return
            if run.status == "paused":
                run.status = "running"
                db.commit()

            path = _path_for_candle(candle, run.path_mode)
            segment_ms = max(int(interval_seconds * 1000 / max(len(path), 1)), 1)
            for point_index, price in enumerate(path):
                point_time = int(candle["open_time"]) + point_index * segment_ms
                price_result = emulator.set_price(
                    run.emulator_account_id, run.symbol, _float(price), point_time
                )
                simulated_dt = datetime.fromtimestamp(point_time / 1000, tz=timezone.utc)
                # The strategy only needs to react when an order was filled. The first
                # point initializes its grid. This keeps multi-year 1m backtests practical
                # while still using the exact live bot reconciliation/order logic.
                if (index == 1 and point_index == 0) or int(price_result.get("filled_orders") or 0) > 0:
                    with use_simulated_time(simulated_dt):
                        _tick_until_stable(db, temp_bot, max_ticks=5)
                    if index == 1 and point_index == 0:
                        _assert_initial_grid_created(db, temp_bot)
                dashboard = emulator.dashboard(run.emulator_account_id, run.symbol)
                values = _dashboard_values(dashboard)

                previous_time = state["previous_time"]
                previous_values = state["previous_values"]
                if previous_time is not None and previous_values is not None:
                    elapsed = max((point_time - previous_time) / 1000, 0)
                    if previous_values["position_qty"] > 0:
                        state["time_in_position"] += elapsed
                        if previous_values["unrealized"] < 0:
                            state["time_in_loss"] += elapsed
                            if state["current_cycle"]:
                                state["current_cycle"]["time_in_loss"] += elapsed
                    if state["drawdown_started"] is not None:
                        state["longest_drawdown"] = max(
                            state["longest_drawdown"], (point_time - state["drawdown_started"]) / 1000
                        )
                    if state["loss_started"] is not None:
                        state["longest_loss"] = max(
                            state["longest_loss"], (point_time - state["loss_started"]) / 1000
                        )

                equity = values["equity"]
                state["peak_equity"] = max(state["peak_equity"], equity)
                drawdown = ((equity - state["peak_equity"]) / state["peak_equity"] * 100) if state["peak_equity"] else 0
                state["current_drawdown"] = drawdown
                if drawdown < state["max_drawdown"]:
                    state["max_drawdown"] = drawdown
                    state["deepest_drawdown_time"] = point_time
                    state["max_drawdown_recovered"] = False
                    state["max_drawdown_recovery"] = 0.0
                if drawdown < -1e-12 and state["drawdown_started"] is None:
                    state["drawdown_started"] = point_time
                elif drawdown >= -1e-12 and state["drawdown_started"] is not None:
                    state["longest_drawdown"] = max(
                        state["longest_drawdown"], (point_time - state["drawdown_started"]) / 1000
                    )
                    if state["deepest_drawdown_time"] is not None and not state["max_drawdown_recovered"]:
                        state["max_drawdown_recovery"] = max(
                            (point_time - state["deepest_drawdown_time"]) / 1000, 0
                        )
                        state["max_drawdown_recovered"] = True
                    state["drawdown_started"] = None

                negative_open = values["position_qty"] > 0 and values["unrealized"] < 0
                if negative_open and state["loss_started"] is None:
                    state["loss_started"] = point_time
                elif not negative_open and state["loss_started"] is not None:
                    state["longest_loss"] = max(
                        state["longest_loss"], (point_time - state["loss_started"]) / 1000
                    )
                    state["loss_started"] = None

                state["max_unrealized_loss"] = min(state["max_unrealized_loss"], values["unrealized"])
                state["max_position_qty"] = max(state["max_position_qty"], values["position_qty"])
                state["max_position_value"] = max(state["max_position_value"], values["position_value"])
                state["max_margin_used"] = max(state["max_margin_used"], values["margin_used"])
                state["lowest_available"] = min(state["lowest_available"], values["available"])

                filled_buy_count = db.query(TradingBotOrder).filter(
                    TradingBotOrder.bot_id == temp_bot.id,
                    TradingBotOrder.side == "Buy",
                    TradingBotOrder.status == "Filled",
                ).count()
                new_entries = max(filled_buy_count - state["filled_buy_count"], 0)
                state["filled_buy_count"] = filled_buy_count

                previous_qty = previous_values["position_qty"] if previous_values else 0
                if previous_qty <= 0 and values["position_qty"] > 0:
                    state["cycle_number"] += 1
                    state["current_cycle"] = {
                        "number": state["cycle_number"],
                        "started_at": point_time,
                        "last_time": point_time,
                        "start_balance": values["balance"],
                        "time_in_loss": 0.0,
                        "max_unrealized_loss": min(values["unrealized"], 0),
                        "max_qty": values["position_qty"],
                        "max_value": values["position_value"],
                        "entries_filled": max(new_entries, 1),
                        "avg_entry": values["avg_entry"],
                    }
                elif state["current_cycle"] and values["position_qty"] > 0:
                    cycle_state = state["current_cycle"]
                    cycle_state["last_time"] = point_time
                    cycle_state["max_unrealized_loss"] = min(cycle_state["max_unrealized_loss"], values["unrealized"])
                    cycle_state["max_qty"] = max(cycle_state["max_qty"], values["position_qty"])
                    cycle_state["max_value"] = max(cycle_state["max_value"], values["position_value"])
                    cycle_state["entries_filled"] += new_entries
                    cycle_state["avg_entry"] = values["avg_entry"] or cycle_state["avg_entry"]
                if previous_qty > 0 and values["position_qty"] <= 0 and state["current_cycle"]:
                    _store_cycle(
                        db, run.id, state["current_cycle"], close_time=point_time,
                        exit_price=_float(price), balance=values["balance"],
                    )
                    state["current_cycle"] = None

                state["previous_time"] = point_time
                state["previous_values"] = values

            run.processed_candles = index
            run.progress = min(index / max(run.total_candles, 1) * 100, 100)
            run.current_time = int(candle["open_time"])
            run.current_price = _float(candle["close"])
            if index == 1 or index % sample_every == 0 or index == run.total_candles:
                db.add(BacktestPoint(
                    run_id=run.id,
                    timestamp=int(candle["open_time"]),
                    open=_float(candle["open"]), high=_float(candle["high"]),
                    low=_float(candle["low"]), close=_float(candle["close"]),
                    balance=values["balance"], equity=values["equity"],
                    available_balance=values["available"], unrealized_pnl=values["unrealized"],
                    position_qty=values["position_qty"], position_value=values["position_value"],
                    drawdown_percent=drawdown,
                ))
            if index % 10 == 0 or index == run.total_candles:
                run.metrics = {
                    "equity": values["equity"],
                    "net_total_pnl": values["equity"] - run.initial_balance,
                    "maximum_drawdown_percent": state["max_drawdown"],
                    "time_in_position_seconds": state["time_in_position"],
                    "maximum_unrealized_loss": state["max_unrealized_loss"],
                }
                db.add(run)
                db.commit()

        final_time = run.end_time
        final_dashboard = emulator.dashboard(run.emulator_account_id, run.symbol)
        final_values = _dashboard_values(final_dashboard)
        if run.end_behavior == "force_close" and final_values["position_qty"] > 0:
            with use_simulated_time(datetime.fromtimestamp(final_time / 1000, tz=timezone.utc)):
                close_bot_position(db, temp_bot)
                db.commit()
                _tick_until_stable(db, temp_bot)
            final_dashboard = emulator.dashboard(run.emulator_account_id, run.symbol)
            final_values = _dashboard_values(final_dashboard)
            if state["current_cycle"] and final_values["position_qty"] <= 0:
                _store_cycle(
                    db, run.id, state["current_cycle"], close_time=final_time,
                    exit_price=run.current_price, balance=final_values["balance"],
                )
                state["current_cycle"] = None

        if state["current_cycle"]:
            _store_cycle(
                db, run.id, state["current_cycle"], close_time=None,
                exit_price=None, balance=final_values["balance"],
            )
            state["current_cycle"] = None

        if state["drawdown_started"] is not None:
            state["longest_drawdown"] = max(
                state["longest_drawdown"], (run.end_time - state["drawdown_started"]) / 1000
            )
        if state["loss_started"] is not None:
            state["longest_loss"] = max(
                state["longest_loss"], (run.end_time - state["loss_started"]) / 1000
            )
        if state["deepest_drawdown_time"] is not None and not state["max_drawdown_recovered"]:
            state["current_drawdown_recovery"] = max(
                (run.end_time - state["deepest_drawdown_time"]) / 1000, 0
            )

        executions = _sorted_executions(
            emulator.executions(run.emulator_account_id, run.symbol, limit=100000)
        )
        cycles = _rebuild_cycles_from_executions(db, run, executions)

        run.metrics = _final_metrics(run, final_dashboard, executions, state, cycles)
        run.status = "completed"
        run.progress = 100
        run.completed_at = _utcnow()
        temp_bot.runtime_status = "stopped"
        temp_bot.stopped_at = _utcnow()
        db.add_all([run, temp_bot])
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        run = db.get(BacktestRun, run_id)
        if run is not None and run.status != "cancelled":
            run.status = "failed"
            run.error = str(exc)
            run.completed_at = _utcnow()
            if run.temp_bot_id:
                failed_bot = db.get(TradingBot, run.temp_bot_id)
                if failed_bot is not None:
                    failed_bot.runtime_status = "stopped"
                    failed_bot.stopped_at = _utcnow()
                    db.add(failed_bot)
            db.add(run)
            db.commit()
    finally:
        emulator.close()
        db.close()
