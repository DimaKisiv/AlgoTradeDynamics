from __future__ import annotations

import math
import secrets
import threading
import time
import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, delete, func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Account, AccountMarket, Candle, Event, Execution, HistoricalDataset, Market, Order, Position, Scenario

ACTIVE_STATUSES = {"New", "Created", "PartiallyFilled", "PendingNew", "Untriggered"}
MAKER_FEE_RATE = 0.0002
TAKER_FEE_RATE = 0.00055
DEFAULT_MARKETS = {
    "BTCUSDT": 65000.0,
    "ETHUSDT": 3500.0,
    "SOLUSDT": 180.0,
}

_execution_sequence_lock = threading.Lock()
_last_execution_sequence = 0


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def market_time(market: Market | AccountMarket | None) -> datetime:
    if isinstance(market, AccountMarket) and market.simulation_time is not None:
        raw = market.simulation_time
    elif isinstance(market, Market):
        raw = (market.runtime_state or {}).get("simulation_time")
    else:
        raw = None
    if raw is not None:
        try:
            value = int(raw)
            if value < 10_000_000_000:
                value *= 1000
            return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
        except (TypeError, ValueError, OSError):
            pass
    return now_utc()


def as_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def make_api_key() -> str:
    return f"emu_{secrets.token_urlsafe(18)}"


def make_api_secret() -> str:
    return secrets.token_urlsafe(32)


def next_execution_sequence() -> int:
    global _last_execution_sequence
    with _execution_sequence_lock:
        wall_clock_sequence = int(time.time() * 1000) * 1000
        _last_execution_sequence = max(wall_clock_sequence, _last_execution_sequence + 1)
        return _last_execution_sequence


def log_event(
    db: Session,
    event_type: str,
    message: str,
    *,
    account_id: int | None = None,
    symbol: str | None = None,
    payload: dict | None = None,
    created_at: datetime | None = None,
) -> Event:
    event = Event(
        created_at=created_at or now_utc(),
        account_id=account_id,
        symbol=symbol,
        event_type=event_type,
        message=message,
        payload=payload or {},
    )
    db.add(event)
    return event


def ensure_seed_data(db: Session) -> None:
    if db.scalar(select(func.count(Account.id))) == 0:
        db.add(
            Account(
                name="Default Emulator Account",
                api_key="emulator-default-key",
                api_secret="emulator-default-secret",
                initial_balance=10000.0,
                balance=10000.0,
            )
        )
    for symbol, price in DEFAULT_MARKETS.items():
        if db.get(Market, symbol) is None:
            db.add(
                Market(
                    symbol=symbol,
                    category="linear",
                    last_price=price,
                    mark_price=price,
                    mode="manual",
                    status="idle",
                    runtime_state={},
                )
            )
    if db.scalar(select(func.count(Scenario.id))) == 0:
        db.add_all(
            [
                Scenario(
                    name="Grid fills and recovery",
                    symbol="ETHUSDT",
                    steps=[
                        {"price": 3500, "duration_seconds": 0},
                        {"price": 3300, "duration_seconds": 8},
                        {"price": 3100, "duration_seconds": 8},
                        {"price": 3650, "duration_seconds": 12},
                    ],
                ),
                Scenario(
                    name="Rapid market drop",
                    symbol="BTCUSDT",
                    steps=[
                        {"price": 65000, "duration_seconds": 0},
                        {"price": 58500, "duration_seconds": 5},
                        {"price": 61000, "duration_seconds": 8},
                    ],
                ),
            ]
        )
    db.commit()


def get_account_by_api_key(db: Session, api_key: str | None) -> Account | None:
    if not api_key:
        return None
    return db.scalar(select(Account).where(Account.api_key == api_key))


def get_or_create_market(db: Session, symbol: str, *, initial_price: float = 100.0) -> Market:
    symbol = symbol.upper()
    market = db.get(Market, symbol)
    if market is None:
        market = Market(
            symbol=symbol,
            category="linear",
            last_price=initial_price,
            mark_price=initial_price,
            mode="manual",
            status="idle",
            runtime_state={},
        )
        db.add(market)
        db.flush()
    return market


def get_or_create_account_market(
    db: Session, account_id: int, symbol: str, *, initial_price: float | None = None
) -> AccountMarket:
    symbol = symbol.upper()
    account_market = db.scalar(
        select(AccountMarket).where(
            AccountMarket.account_id == account_id,
            AccountMarket.symbol == symbol,
        )
    )
    if account_market is None:
        global_market = get_or_create_market(db, symbol, initial_price=initial_price or 100.0)
        price = initial_price if initial_price is not None else global_market.last_price
        account_market = AccountMarket(
            account_id=account_id,
            symbol=symbol,
            last_price=price,
            mark_price=price,
            simulation_time=None,
            updated_at=now_utc(),
        )
        db.add(account_market)
        db.flush()
    return account_market


def effective_market(db: Session, account_id: int, symbol: str) -> Market | AccountMarket:
    symbol = symbol.upper()
    account_market = db.scalar(
        select(AccountMarket).where(
            AccountMarket.account_id == account_id,
            AccountMarket.symbol == symbol,
        )
    )
    return account_market or get_or_create_market(db, symbol)


def get_or_create_position(db: Session, account_id: int, category: str, symbol: str) -> Position:
    position = db.scalar(
        select(Position).where(
            Position.account_id == account_id,
            Position.category == category,
            Position.symbol == symbol,
        )
    )
    if position is None:
        position = Position(
            account_id=account_id,
            category=category,
            symbol=symbol,
            side="Buy",
            size=0.0,
            avg_price=0.0,
            leverage=10.0,
            trade_mode="Cross",
        )
        db.add(position)
        db.flush()
    return position


def serialize_order(order: Order) -> dict:
    leaves = max(order.qty - order.cum_exec_qty, 0.0)
    return {
        "orderId": order.id,
        "orderLinkId": order.order_link_id or "",
        "category": order.category,
        "symbol": order.symbol,
        "side": order.side,
        "orderType": order.order_type,
        "price": "" if order.price is None else format_number(order.price),
        "qty": format_number(order.qty),
        "cumExecQty": format_number(order.cum_exec_qty),
        "leavesQty": format_number(leaves),
        "avgPrice": "" if order.avg_price is None else format_number(order.avg_price),
        "orderStatus": order.status,
        "reduceOnly": order.reduce_only,
        "rejectReason": order.reject_reason or "EC_NoError",
        "createdTime": str(int(order.created_at.timestamp() * 1000)),
        "updatedTime": str(int(order.updated_at.timestamp() * 1000)),
    }


def format_number(value: float | int | None) -> str:
    if value is None:
        return ""
    if math.isclose(float(value), 0.0, abs_tol=1e-15):
        return "0"
    return f"{float(value):.12f}".rstrip("0").rstrip(".")


def account_snapshot(db: Session, account: Account, *, exclude_order_id: str | None = None) -> dict:
    positions = db.scalars(select(Position).where(Position.account_id == account.id)).all()
    unrealized = 0.0
    margin_used = 0.0
    for position in positions:
        if position.size <= 0:
            continue
        market = effective_market(db, account.id, position.symbol)
        direction = 1.0 if position.side == "Buy" else -1.0
        unrealized += (market.mark_price - position.avg_price) * position.size * direction
        leverage = max(position.leverage, 1.0)
        margin_used += position.size * market.mark_price / leverage
    reserved_order_margin = 0.0
    open_orders = db.scalars(
        select(Order).where(
            Order.account_id == account.id,
            Order.status.in_(ACTIVE_STATUSES),
            Order.reduce_only.is_(False),
        )
    ).all()
    for order in open_orders:
        if exclude_order_id and order.id == exclude_order_id:
            continue
        order_market = effective_market(db, account.id, order.symbol)
        order_position = db.scalar(
            select(Position).where(
                Position.account_id == account.id,
                Position.category == order.category,
                Position.symbol == order.symbol,
            )
        )
        leverage = max(order_position.leverage if order_position else 10.0, 1.0)
        reserved_order_margin += max(order.qty - order.cum_exec_qty, 0.0) * (order.price or order_market.last_price) / leverage
    equity = account.balance + unrealized
    available = max(equity - margin_used - reserved_order_margin, 0.0)
    return {
        "account_id": account.id,
        "name": account.name,
        "initial_balance": account.initial_balance,
        "balance": account.balance,
        "equity": equity,
        "available_balance": available,
        "unrealized_pnl": unrealized,
        "margin_used": margin_used,
        "reserved_order_margin": reserved_order_margin,
    }


def position_payload(db: Session, position: Position) -> dict:
    market = effective_market(db, position.account_id, position.symbol)
    direction = 1.0 if position.side == "Buy" else -1.0
    unrealized = (market.mark_price - position.avg_price) * position.size * direction if position.size > 0 else 0.0
    position_value = position.size * market.mark_price
    account = db.get(Account, position.account_id)
    liq_price = 0.0
    if position.size > 0 and account is not None:
        distance = max(account.balance, 0.0) / position.size
        liq_price = max(position.avg_price - distance, 0.0) if position.side == "Buy" else position.avg_price + distance
    return {
        "positionIdx": 0,
        "riskId": 0,
        "symbol": position.symbol,
        "side": position.side if position.size > 0 else "",
        "size": format_number(position.size),
        "avgPrice": format_number(position.avg_price) if position.size > 0 else "",
        "positionValue": format_number(position_value),
        "tradeMode": position.trade_mode,
        "positionStatus": "Normal",
        "autoAddMargin": 0,
        "adlRankIndicator": 0,
        "leverage": format_number(position.leverage),
        "positionBalance": format_number(position_value / max(position.leverage, 1.0)),
        "markPrice": format_number(market.mark_price),
        "liqPrice": format_number(liq_price),
        "bustPrice": "",
        "positionMM": "0",
        "positionIM": format_number(position_value / max(position.leverage, 1.0)),
        "tpslMode": "Full",
        "takeProfit": "",
        "stopLoss": "",
        "trailingStop": "0",
        "unrealisedPnl": format_number(unrealized),
        "curRealisedPnl": format_number(position.realized_pnl),
        "cumRealisedPnl": format_number(position.realized_pnl),
        "seq": 0,
        "isReduceOnly": False,
        "mmrSysUpdatedTime": "",
        "leverageSysUpdatedTime": "",
        "createdTime": "",
        "updatedTime": str(int(position.updated_at.timestamp() * 1000)),
    }


def _validate_order(db: Session, account: Account, order: Order, market: Market) -> str | None:
    if order.qty <= 0:
        return "Order quantity must be greater than zero"
    if order.order_type not in {"Limit", "Market"}:
        return f"Unsupported order type: {order.order_type}"
    if order.side not in {"Buy", "Sell"}:
        return f"Unsupported side: {order.side}"
    if order.order_type == "Limit" and (order.price is None or order.price <= 0):
        return "Limit price must be greater than zero"
    if order.qty * (order.price or market.last_price) < 5:
        return "Order notional is below emulator minimum 5 USDT"
    position = get_or_create_position(db, account.id, order.category, order.symbol)
    if order.reduce_only:
        if position.size <= 0:
            return "No open position available to reduce"
        expected_side = "Sell" if position.side == "Buy" else "Buy"
        if order.side != expected_side:
            return "Reduce-only side does not close the open position"
        if order.qty > position.size + 1e-12:
            return "Reduce-only quantity exceeds open position"
    else:
        if position.size > 0 and position.side != order.side:
            return "Close the opposite position before reversing side"
        required_margin = order.qty * (order.price or market.last_price) / max(position.leverage, 1.0)
        snapshot = account_snapshot(db, account, exclude_order_id=order.id)
        if required_margin > snapshot["available_balance"] + 1e-9:
            return "Insufficient available balance"
    return None


def create_order(
    db: Session,
    account: Account,
    *,
    category: str,
    symbol: str,
    side: str,
    order_type: str,
    qty: float,
    price: float | None,
    reduce_only: bool,
    order_link_id: str | None,
) -> tuple[Order, int, str]:
    symbol = symbol.upper()
    market = effective_market(db, account.id, symbol)
    if order_link_id:
        existing = db.scalar(
            select(Order).where(Order.account_id == account.id, Order.order_link_id == order_link_id)
        )
        if existing is not None:
            return existing, 110072, "OrderLinkedID is duplicate"

    event_time = market_time(market)
    order = Order(
        id=uuid.uuid4().hex,
        created_at=event_time,
        updated_at=event_time,
        account_id=account.id,
        category=category,
        symbol=symbol,
        side=side,
        order_type=order_type,
        qty=qty,
        price=price,
        reduce_only=reduce_only,
        order_link_id=order_link_id,
        status="New",
    )
    db.add(order)
    db.flush()
    reject_reason = _validate_order(db, account, order, market)
    if reject_reason:
        order.status = "Rejected"
        order.reject_reason = reject_reason
        log_event(
            db,
            "order_rejected",
            reject_reason,
            account_id=account.id,
            symbol=symbol,
            payload={"order_id": order.id, "order_link_id": order_link_id},
            created_at=event_time,
        )
        db.commit()
        return order, 10001, reject_reason

    log_event(
        db,
        "order_created",
        f"{side} {order_type} order created",
        account_id=account.id,
        symbol=symbol,
        payload={"order_id": order.id, "order_link_id": order_link_id, "qty": qty, "price": price},
        created_at=event_time,
    )
    if order_type == "Market":
        fill_order(db, order, market.last_price, liquidity="Taker")
    else:
        maybe_fill_order(db, order, market.last_price)
    db.commit()
    return order, 0, "OK"


def maybe_fill_order(db: Session, order: Order, market_price: float) -> bool:
    if order.status not in ACTIVE_STATUSES:
        return False
    if order.order_type == "Market":
        fill_order(db, order, market_price, liquidity="Taker")
        return True
    if order.side == "Buy" and market_price <= (order.price or 0):
        fill_order(db, order, order.price or market_price, liquidity="Maker")
        return True
    if order.side == "Sell" and market_price >= (order.price or float("inf")):
        fill_order(db, order, order.price or market_price, liquidity="Maker")
        return True
    return False


def fill_order(db: Session, order: Order, fill_price: float, *, liquidity: str) -> None:
    if order.status not in ACTIVE_STATUSES:
        return
    account = db.get(Account, order.account_id)
    if account is None:
        return
    position = get_or_create_position(db, order.account_id, order.category, order.symbol)
    qty = max(order.qty - order.cum_exec_qty, 0.0)
    if qty <= 0:
        return

    if liquidity == "Taker" and account.slippage_percent > 0:
        adjustment = account.slippage_percent / 100
        fill_price = fill_price * (1 + adjustment if order.side == "Buy" else 1 - adjustment)

    closed_pnl = 0.0
    if order.reduce_only:
        close_qty = min(qty, position.size)
        if close_qty <= 0:
            order.status = "Rejected"
            order.reject_reason = "No position available to reduce"
            return
        if position.side == "Buy":
            closed_pnl = (fill_price - position.avg_price) * close_qty
        else:
            closed_pnl = (position.avg_price - fill_price) * close_qty
        position.size -= close_qty
        position.realized_pnl += closed_pnl
        if position.size <= 1e-12:
            position.size = 0.0
            position.avg_price = 0.0
    else:
        if position.size > 0 and position.side != order.side:
            order.status = "Rejected"
            order.reject_reason = "Close the opposite position before reversing side"
            return
        old_cost = position.avg_price * position.size
        new_size = position.size + qty
        position.avg_price = (old_cost + fill_price * qty) / new_size if new_size > 0 else 0.0
        position.size = new_size
        position.side = order.side

    fee_rate = account.maker_fee_rate if liquidity == "Maker" else account.taker_fee_rate
    fee = fill_price * qty * fee_rate
    account.balance += closed_pnl - fee

    order.cum_exec_qty += qty
    order.avg_price = fill_price
    order.status = "Filled"
    market = effective_market(db, account.id, order.symbol)
    event_time = market_time(market)
    order.updated_at = event_time
    position.updated_at = event_time
    execution = Execution(
        id=uuid.uuid4().hex,
        created_at=event_time,
        account_id=account.id,
        order_id=order.id,
        symbol=order.symbol,
        side=order.side,
        price=fill_price,
        qty=qty,
        fee=fee,
        closed_pnl=closed_pnl,
        sequence_no=next_execution_sequence(),
    )
    db.add(execution)
    log_event(
        db,
        "order_filled",
        f"{order.side} order filled at {format_number(fill_price)}",
        account_id=account.id,
        symbol=order.symbol,
        payload={
            "order_id": order.id,
            "order_link_id": order.order_link_id,
            "qty": qty,
            "price": fill_price,
            "fee": fee,
            "closed_pnl": closed_pnl,
        },
        created_at=event_time,
    )
    log_event(
        db,
        "position_updated",
        f"Position size is now {format_number(position.size)}",
        account_id=account.id,
        symbol=order.symbol,
        payload={"side": position.side, "size": position.size, "avg_price": position.avg_price, "realized_pnl": position.realized_pnl},
        created_at=event_time,
    )


def set_account_market_price(
    db: Session,
    account_id: int,
    symbol: str,
    price: float,
    *,
    mark_price: float | None = None,
    simulation_time: int | None = None,
    dataset_id: int | None = None,
    emit_event: bool = False,
) -> tuple[AccountMarket, int]:
    if price <= 0:
        raise ValueError("Price must be greater than zero")
    market = get_or_create_account_market(db, account_id, symbol, initial_price=price)
    old_price = market.last_price
    market.last_price = price
    market.mark_price = mark_price if mark_price and mark_price > 0 else price
    market.simulation_time = simulation_time
    if dataset_id is not None:
        market.dataset_id = dataset_id
    event_time = market_time(market)
    market.updated_at = event_time
    orders = db.scalars(
        select(Order).where(
            Order.account_id == account_id,
            Order.symbol == market.symbol,
            Order.status.in_(ACTIVE_STATUSES),
        ).order_by(Order.created_at)
    ).all()
    filled_count = 0
    for order in orders:
        if maybe_fill_order(db, order, price):
            filled_count += 1
    if emit_event and (not math.isclose(old_price, price) or filled_count):
        log_event(
            db,
            "market_price",
            f"{market.symbol} isolated price changed {format_number(old_price)} → {format_number(price)}",
            account_id=account_id,
            symbol=market.symbol,
            payload={"old_price": old_price, "price": price, "source": "backtest", "filled_orders": filled_count},
            created_at=event_time,
        )
    db.flush()
    return market, filled_count


def set_market_price(
    db: Session,
    symbol: str,
    price: float,
    *,
    mark_price: float | None = None,
    source: str = "manual",
    emit_event: bool = True,
    simulation_time: int | None = None,
) -> Market:
    if price <= 0:
        raise ValueError("Price must be greater than zero")
    market = get_or_create_market(db, symbol, initial_price=price)
    old_price = market.last_price
    if simulation_time is not None:
        state = dict(market.runtime_state or {})
        state["simulation_time"] = int(simulation_time)
        market.runtime_state = state
    event_time = market_time(market)
    market.last_price = price
    market.mark_price = mark_price if mark_price and mark_price > 0 else price
    market.updated_at = event_time
    isolated_accounts = select(AccountMarket.account_id).where(AccountMarket.symbol == market.symbol)
    orders = db.scalars(
        select(Order).where(
            Order.symbol == market.symbol,
            Order.status.in_(ACTIVE_STATUSES),
            ~Order.account_id.in_(isolated_accounts),
        ).order_by(Order.created_at)
    ).all()
    filled_count = 0
    for order in orders:
        if maybe_fill_order(db, order, price):
            filled_count += 1
    if emit_event and (not math.isclose(old_price, price) or filled_count):
        log_event(
            db,
            "market_price",
            f"{market.symbol} price changed {format_number(old_price)} → {format_number(price)}",
            symbol=market.symbol,
            payload={"old_price": old_price, "price": price, "source": source, "filled_orders": filled_count},
            created_at=event_time,
        )
    db.flush()
    return market


def cancel_order(db: Session, account: Account, *, order_id: str | None, order_link_id: str | None) -> Order | None:
    conditions = [Order.account_id == account.id]
    if order_id:
        conditions.append(Order.id == order_id)
    elif order_link_id:
        conditions.append(Order.order_link_id == order_link_id)
    else:
        return None
    order = db.scalar(select(Order).where(*conditions))
    if order is None:
        return None
    if order.status in ACTIVE_STATUSES:
        event_time = market_time(effective_market(db, account.id, order.symbol))
        order.status = "Cancelled"
        order.updated_at = event_time
        log_event(
            db,
            "order_cancelled",
            "Order cancelled",
            account_id=account.id,
            symbol=order.symbol,
            payload={"order_id": order.id, "order_link_id": order.order_link_id},
            created_at=event_time,
        )
        db.commit()
    return order


def reset_account(db: Session, account: Account, *, balance: float | None = None) -> None:
    db.execute(delete(Execution).where(Execution.account_id == account.id))
    db.execute(delete(Order).where(Order.account_id == account.id))
    db.execute(delete(Position).where(Position.account_id == account.id))
    db.execute(delete(Event).where(Event.account_id == account.id))
    account.initial_balance = balance if balance is not None else account.initial_balance
    account.balance = account.initial_balance
    log_event(db, "account_reset", "Account reset", account_id=account.id, payload={"balance": account.balance})
    db.commit()


def start_manual_move(db: Session, market: Market, *, target_price: float, duration_seconds: float) -> None:
    if target_price <= 0:
        raise ValueError("Target price must be greater than zero")
    if duration_seconds <= 0:
        market.mode = "manual"
        market.status = "idle"
        market.runtime_state = {}
        set_market_price(db, market.symbol, target_price, source="manual")
        db.commit()
        return
    market.mode = "manual"
    market.status = "running"
    market.runtime_state = {
        "kind": "move",
        "start_price": market.last_price,
        "target_price": target_price,
        "duration_seconds": duration_seconds,
        "started_at": time.time(),
    }
    db.commit()


def start_scenario(db: Session, market: Market, scenario: Scenario) -> None:
    market.mode = "scenario"
    market.status = "running"
    market.runtime_state = {
        "scenario_id": scenario.id,
        "step_index": 0,
        "step_started_at": time.time(),
        "step_start_price": market.last_price,
    }
    log_event(db, "scenario_started", f"Scenario '{scenario.name}' started", symbol=market.symbol, payload={"scenario_id": scenario.id})
    db.commit()


def scenario_step_once(db: Session, market: Market) -> None:
    state = dict(market.runtime_state or {})
    scenario_id = state.get("scenario_id")
    scenario = db.get(Scenario, scenario_id) if scenario_id else None
    if scenario is None:
        market.status = "idle"
        market.runtime_state = {}
        db.commit()
        return
    index = int(state.get("step_index", 0))
    if index >= len(scenario.steps):
        market.status = "completed"
        db.commit()
        return
    step = scenario.steps[index]
    set_market_price(db, market.symbol, as_float(step.get("price"), market.last_price), source="scenario")
    index += 1
    state["step_index"] = index
    state["step_started_at"] = time.time()
    state["step_start_price"] = market.last_price
    market.runtime_state = state
    market.status = "completed" if index >= len(scenario.steps) else "paused"
    db.commit()


def start_replay(
    db: Session,
    market: Market,
    *,
    dataset_id: int,
    start_time: int,
    end_time: int,
    speed: float,
    path_mode: str,
) -> int:
    dataset = db.get(HistoricalDataset, dataset_id)
    if dataset is None:
        raise ValueError("Historical dataset not found")
    if dataset.symbol != market.symbol:
        raise ValueError("Dataset symbol does not match selected market")
    count = db.scalar(
        select(func.count(Candle.id)).where(
            Candle.dataset_id == dataset.id,
            Candle.open_time >= start_time,
            Candle.open_time <= end_time,
        )
    ) or 0
    if count == 0:
        raise ValueError("No historical candles found for selected range")
    first = db.scalar(
        select(Candle)
        .where(
            Candle.dataset_id == dataset.id,
            Candle.open_time >= start_time,
            Candle.open_time <= end_time,
        )
        .order_by(Candle.open_time)
    )
    market.mode = "historical"
    market.status = "running"
    market.runtime_state = {
        "dataset_id": dataset.id,
        "dataset_name": dataset.name,
        "interval": dataset.interval,
        "start_time": start_time,
        "end_time": end_time,
        "cursor": first.open_time if first else start_time,
        "processed": 0,
        "total": int(count),
        "speed": max(speed, 0.1),
        "path_mode": path_mode,
        "last_advance": time.time(),
    }
    if first:
        set_market_price(db, market.symbol, first.open, source="historical")
    log_event(db, "replay_started", "Historical replay started", symbol=market.symbol, payload=dict(market.runtime_state))
    db.commit()
    return int(count)


def replay_one_candle(db: Session, market: Market, *, commit: bool = True) -> bool:
    state = dict(market.runtime_state or {})
    cursor = int(state.get("cursor", state.get("start_time", 0)))
    end_time = int(state.get("end_time", cursor))
    dataset_id = int(state.get("dataset_id", 0))
    candle = db.scalar(
        select(Candle)
        .where(
            Candle.dataset_id == dataset_id,
            Candle.open_time >= cursor,
            Candle.open_time <= end_time,
        )
        .order_by(Candle.open_time)
    )
    if candle is None:
        market.status = "completed"
        if commit:
            db.commit()
        else:
            db.flush()
        return False
    path_mode = state.get("path_mode", "ohlc")
    if path_mode == "olhc":
        path = [candle.open, candle.low, candle.high, candle.close]
    elif path_mode == "close":
        path = [candle.close]
    else:
        path = [candle.open, candle.high, candle.low, candle.close]
    for price in path:
        set_market_price(db, market.symbol, price, source="historical", emit_event=False)
    processed = int(state.get("processed", 0)) + 1
    state["processed"] = processed
    state["cursor"] = candle.open_time + 1
    state["current_candle_time"] = candle.open_time
    state["current_ohlc"] = {
        "open": candle.open,
        "high": candle.high,
        "low": candle.low,
        "close": candle.close,
    }
    state["last_advance"] = time.time()
    market.runtime_state = state
    total = int(state.get("total", processed))
    sample_every = max(total // 500, 1)
    if processed == 1 or processed % sample_every == 0 or processed >= total:
        log_event(
            db,
            "market_price",
            f"{market.symbol} historical candle closed at {format_number(candle.close)}",
            symbol=market.symbol,
            payload={"price": candle.close, "source": "historical", "open_time": candle.open_time},
        )
    if processed >= total:
        market.status = "completed"
        log_event(db, "replay_completed", "Historical replay completed", symbol=market.symbol, payload={"processed": processed})
    if commit:
        db.commit()
    else:
        db.flush()
    return True


def _tick_manual(db: Session, market: Market, now: float) -> None:
    state = dict(market.runtime_state or {})
    if state.get("kind") != "move":
        return
    duration = max(as_float(state.get("duration_seconds"), 0.0), 0.001)
    progress = min(max((now - as_float(state.get("started_at"), now)) / duration, 0.0), 1.0)
    start_price = as_float(state.get("start_price"), market.last_price)
    target = as_float(state.get("target_price"), market.last_price)
    next_price = start_price + (target - start_price) * progress
    emit_event = progress >= 1.0 or now - as_float(state.get("last_event_at"), 0.0) >= 0.5
    set_market_price(db, market.symbol, next_price, source="manual-move", emit_event=emit_event)
    if emit_event:
        state["last_event_at"] = now
    if progress >= 1.0:
        market.status = "completed"
        market.runtime_state = {}
    else:
        market.runtime_state = state
    db.commit()


def _tick_scenario(db: Session, market: Market, now: float) -> None:
    state = dict(market.runtime_state or {})
    scenario = db.get(Scenario, state.get("scenario_id"))
    if scenario is None:
        market.status = "idle"
        market.runtime_state = {}
        db.commit()
        return
    index = int(state.get("step_index", 0))
    if index >= len(scenario.steps):
        market.status = "completed"
        db.commit()
        return
    step = scenario.steps[index]
    target = as_float(step.get("price"), market.last_price)
    duration = max(as_float(step.get("duration_seconds"), 0.0), 0.0)
    started_at = as_float(state.get("step_started_at"), now)
    start_price = as_float(state.get("step_start_price"), market.last_price)
    progress = 1.0 if duration <= 0 else min(max((now - started_at) / duration, 0.0), 1.0)
    next_price = start_price + (target - start_price) * progress
    emit_event = progress >= 1.0 or now - as_float(state.get("last_event_at"), 0.0) >= 0.5
    set_market_price(db, market.symbol, next_price, source="scenario", emit_event=emit_event)
    if emit_event:
        state["last_event_at"] = now
    if progress >= 1.0:
        index += 1
        state["step_index"] = index
        state["step_started_at"] = now
        state["step_start_price"] = target
        market.runtime_state = state
        if index >= len(scenario.steps):
            market.status = "completed"
            log_event(db, "scenario_completed", f"Scenario '{scenario.name}' completed", symbol=market.symbol)
    else:
        market.runtime_state = state
    db.commit()


def _tick_historical(db: Session, market: Market, now: float) -> None:
    state = dict(market.runtime_state or {})
    last = as_float(state.get("last_advance"), now)
    speed = max(as_float(state.get("speed"), 1.0), 0.1)
    due = int((now - last) * speed)
    if due <= 0:
        return
    due = min(due, 500)
    for _ in range(due):
        if market.status != "running" or not replay_one_candle(db, market, commit=False):
            break
    db.commit()


def tick_once() -> None:
    with SessionLocal() as db:
        markets = db.scalars(select(Market).where(Market.status == "running")).all()
        current = time.time()
        for market in markets:
            try:
                if market.mode == "manual":
                    _tick_manual(db, market, current)
                elif market.mode == "scenario":
                    _tick_scenario(db, market, current)
                elif market.mode == "historical":
                    _tick_historical(db, market, current)
            except Exception as exc:  # noqa: BLE001
                market.status = "error"
                state = dict(market.runtime_state or {})
                state["error"] = str(exc)
                market.runtime_state = state
                log_event(db, "runtime_error", str(exc), symbol=market.symbol)
                db.commit()


class RuntimeWorker:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="exchange-emulator-runtime", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    def _run(self) -> None:
        while not self._stop.is_set():
            tick_once()
            self._stop.wait(0.2)


runtime_worker = RuntimeWorker()
