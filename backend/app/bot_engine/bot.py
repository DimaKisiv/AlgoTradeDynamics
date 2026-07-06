"""Bot runtime orchestration for one-shot grid bot cycles."""
from __future__ import annotations

from datetime import datetime, timezone

from app.bot_engine.bybit.client import get_bybit_session
from app.bot_engine.market_data import get_last_price
from app.bot_engine.orders import FINAL_ORDER_STATUSES, get_open_orders, get_order_status, place_order, cancel_order
from app.bot_engine.positions import get_open_positions
from app.bot_engine.strategies.grid_strategy import decide_grid_action
from app.models.trading_bot import TradingBot
from app.models.trading_bot_order import TradingBotOrder
from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _record_order(db, bot: TradingBot, order_request, response: dict) -> TradingBotOrder:
    result = response.get("result", {})
    order = TradingBotOrder(
        bot_id=bot.id,
        user_id=bot.user_id,
        exchange=bot.exchange,
        environment=bot.environment,
        category=bot.category,
        symbol=bot.symbol,
        side=order_request.side,
        order_type=order_request.order_type,
        order_role=order_request.order_role,
        qty=order_request.qty,
        price=order_request.price,
        exchange_order_id=result.get("orderId"),
        status=result.get("orderStatus") or response.get("retMsg") or "New",
        raw_response=response,
    )
    db.add(order)
    db.flush()
    return order


def run_grid_bot_once(db, bot: TradingBot, current_user: User) -> dict:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")
    if not bot.is_active:
        raise ValueError("Trading bot is inactive")

    session = get_bybit_session(bot)
    now = _utcnow()

    try:
        positions = get_open_positions(
            session, category=bot.category, symbol=bot.symbol)
        open_orders = get_open_orders(
            session, category=bot.category, symbol=bot.symbol)
        price = get_last_price(
            session, category=bot.category, symbol=bot.symbol)

        decision = decide_grid_action(
            bot,
            current_price=price,
            has_positions=bool(positions),
            has_open_orders=bool(open_orders),
        )

        created_orders: list[TradingBotOrder] = []
        if decision["action"] == "CREATE_GRID":
            for order_request in decision["orders"]:
                response = place_order(
                    session,
                    category=bot.category,
                    symbol=bot.symbol,
                    order=order_request,
                )
                created_orders.append(_record_order(
                    db, bot, order_request, response))
            bot.runtime_status = "running"
            bot.started_at = bot.started_at or now
        else:
            bot.runtime_status = "running" if open_orders else "stopped"

        bot.last_run_at = now
        bot.last_error = None
        bot.stopped_at = None if bot.runtime_status == "running" else bot.stopped_at
        db.add(bot)
        db.commit()
        db.refresh(bot)

        for order in created_orders:
            db.refresh(order)

        return {
            "bot": bot,
            "orders": created_orders,
            "action": decision["action"],
            "message": decision["message"],
        }
    except Exception as exc:
        bot.runtime_status = "error"
        bot.last_error = str(exc)
        bot.last_run_at = now
        db.add(bot)
        db.commit()
        raise


def stop_grid_bot_once(db, bot: TradingBot, current_user: User, *, cancel_open: bool = True) -> TradingBot:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")

    session = get_bybit_session(bot)
    if cancel_open:
        open_records = (
            db.query(TradingBotOrder)
            .filter(
                TradingBotOrder.bot_id == bot.id,
                TradingBotOrder.user_id == current_user.id,
                TradingBotOrder.exchange_order_id.isnot(None),
                TradingBotOrder.status.notin_(FINAL_ORDER_STATUSES),
            )
            .all()
        )
        for record in open_records:
            response = cancel_order(
                session,
                category=bot.category,
                symbol=bot.symbol,
                order_id=record.exchange_order_id,
            )
            record.status = "Cancelled"
            record.raw_response = response
            db.add(record)

    bot.runtime_status = "stopped"
    bot.stopped_at = _utcnow()
    bot.last_error = None
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return bot


def sync_grid_bot_orders(db, bot: TradingBot, current_user: User) -> list[TradingBotOrder]:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")

    session = get_bybit_session(bot)
    records = (
        db.query(TradingBotOrder)
        .filter(
            TradingBotOrder.bot_id == bot.id,
            TradingBotOrder.user_id == current_user.id,
        )
        .order_by(TradingBotOrder.created_at.desc(), TradingBotOrder.id.desc())
        .all()
    )

    for record in records:
        if not record.exchange_order_id or record.status in FINAL_ORDER_STATUSES:
            continue
        response = get_order_status(
            session,
            category=record.category,
            symbol=record.symbol,
            order_id=record.exchange_order_id,
        )
        if response:
            record.status = response.get("orderStatus") or record.status
            record.price = float(response["price"]) if response.get(
                "price") else record.price
            record.raw_response = response
            db.add(record)

    bot.last_run_at = _utcnow()
    bot.last_error = None
    db.add(bot)
    db.commit()

    for record in records:
        db.refresh(record)
    db.refresh(bot)
    return records
