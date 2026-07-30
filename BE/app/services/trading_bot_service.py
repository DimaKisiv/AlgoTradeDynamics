"""Service layer for user-owned trading bot CRUD operations."""
from datetime import datetime, timezone

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.bot_engine.bot import run_grid_bot_once, stop_grid_bot_once, sync_grid_bot_orders, sync_bot_orders
from app.bot_engine.performance import get_performance_summary
from app.bot_engine.grid_runtime import (
    cancel_all_bot_orders,
    close_bot_position,
    get_effective_bot_settings,
    get_position_snapshot,
    get_risk_summary,
    get_runtime_state,
)
from app.models.trading_bot import TradingBot
from app.models.trading_bot_event import TradingBotEvent
from app.models.trading_bot_order import TradingBotOrder
from app.models.user import User
from app.schemas.trading_bot import TradingBotCreate, TradingBotUpdate


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_trading_bot(db: Session, bot: TradingBot) -> dict:
    runtime_state, last_risk_message = get_runtime_state(db, bot)
    return {
        "id": bot.id,
        "user_id": bot.user_id,
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
        "settings": get_effective_bot_settings(bot),
        "order_link_generation": bot.order_link_generation,
        "runtime_status": bot.runtime_status,
        "runtime_state": runtime_state,
        "last_risk_message": last_risk_message,
        "created_at": bot.created_at,
        "updated_at": bot.updated_at,
        "started_at": bot.started_at,
        "stopped_at": bot.stopped_at,
        "last_run_at": bot.last_run_at,
        "last_error": bot.last_error,
    }


def serialize_trading_bot(db: Session, bot: TradingBot) -> dict:
    return _serialize_trading_bot(db, bot)


def list_trading_bots(db: Session, user_id: int, limit: int = 100) -> list[TradingBot]:
    bots = (
        db.query(TradingBot)
        .filter(TradingBot.user_id == user_id, TradingBot.is_backtest.is_(False))
        .order_by(desc(TradingBot.updated_at), desc(TradingBot.id))
        .limit(limit)
        .all()
    )
    return [_serialize_trading_bot(db, bot) for bot in bots]


def get_trading_bot(db: Session, bot_id: int, user_id: int) -> TradingBot | None:
    return (
        db.query(TradingBot)
        .filter(
            TradingBot.id == bot_id, TradingBot.user_id == user_id, TradingBot.is_backtest.is_(False)
        )
        .first()
    )


def create_trading_bot(db: Session, payload: TradingBotCreate, user_id: int) -> TradingBot:
    bot = TradingBot(user_id=user_id, **payload.model_dump())
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return _serialize_trading_bot(db, bot)


def update_trading_bot(
    db: Session,
    bot: TradingBot,
    payload: TradingBotUpdate,
) -> TradingBot:
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(bot, field, value)
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return _serialize_trading_bot(db, bot)


def delete_trading_bot(db: Session, bot: TradingBot) -> None:
    db.delete(bot)
    db.commit()


def list_trading_bot_orders(db: Session, bot_id: int, user_id: int) -> list[TradingBotOrder]:
    return (
        db.query(TradingBotOrder)
        .filter(TradingBotOrder.bot_id == bot_id, TradingBotOrder.user_id == user_id)
        .order_by(desc(TradingBotOrder.created_at), desc(TradingBotOrder.id))
        .all()
    )


def list_trading_bot_events(db: Session, bot_id: int, user_id: int, limit: int = 100) -> list[TradingBotEvent]:
    return (
        db.query(TradingBotEvent)
        .filter(TradingBotEvent.bot_id == bot_id, TradingBotEvent.user_id == user_id)
        .order_by(desc(TradingBotEvent.created_at), desc(TradingBotEvent.id))
        .limit(limit)
        .all()
    )


def start_trading_bot_cycle(db: Session, bot: TradingBot, current_user: User) -> dict:
    result = run_grid_bot_once(db, bot, current_user)
    return {
        **result,
        "bot": _serialize_trading_bot(db, result["bot"]),
    }


def stop_trading_bot_cycle(db: Session, bot: TradingBot, current_user: User) -> TradingBot:
    stopped = stop_grid_bot_once(db, bot, current_user)
    return _serialize_trading_bot(db, stopped)


def sync_trading_bot_orders(db: Session, bot: TradingBot, current_user: User) -> list[TradingBotOrder]:
    return sync_grid_bot_orders(db, bot, current_user)


def cancel_trading_bot_orders(db: Session, bot: TradingBot, current_user: User) -> list[TradingBotOrder]:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")

    # Stop bot first so the worker does not recreate cancelled orders.
    bot.runtime_status = "stopped"
    bot.stopped_at = _utcnow()
    bot.last_error = None
    db.add(bot)
    db.flush()

    cancelled = cancel_all_bot_orders(db, bot)

    db.commit()
    return cancelled


def clear_trading_bot_history(db: Session, bot: TradingBot, current_user: User) -> dict:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")

    exchange_cancel_error = None
    exchange_orders_cancelled = 0

    # Stop first so worker does not recreate orders while we clear history.
    bot.runtime_status = "stopped"
    bot.stopped_at = _utcnow()
    bot.started_at = None
    bot.last_run_at = None
    bot.last_error = None
    db.add(bot)
    db.flush()

    # Best effort: sync and cancel current bot orders on exchange.
    try:
        sync_bot_orders(db, bot, include_legacy=True)
        cancelled = cancel_all_bot_orders(db, bot)
        exchange_orders_cancelled = len(cancelled)
        db.flush()
    except Exception as exc:  # noqa: BLE001
        exchange_cancel_error = str(exc)

    orders_deleted = (
        db.query(TradingBotOrder)
        .filter(
            TradingBotOrder.bot_id == bot.id,
            TradingBotOrder.user_id == current_user.id,
        )
        .delete(synchronize_session=False)
    )

    events_deleted = (
        db.query(TradingBotEvent)
        .filter(
            TradingBotEvent.bot_id == bot.id,
            TradingBotEvent.user_id == current_user.id,
        )
        .delete(synchronize_session=False)
    )

    bot.order_link_generation += 1

    db.add(bot)
    db.commit()
    db.refresh(bot)

    return {
        "message": "Bot history cleared",
        "bot_id": bot.id,
        "orders_deleted": orders_deleted,
        "events_deleted": events_deleted,
        "exchange_orders_cancelled": exchange_orders_cancelled,
        "exchange_cancel_error": exchange_cancel_error,
    }


def get_trading_bot_position(db: Session, bot: TradingBot, current_user: User) -> dict:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")
    return get_position_snapshot(db, bot)


def get_trading_bot_risk(db: Session, bot: TradingBot, current_user: User) -> dict:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")
    return get_risk_summary(db, bot)


def get_trading_bot_performance(db: Session, bot: TradingBot, current_user: User) -> dict:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")
    return get_performance_summary(db, bot)


def close_trading_bot_position(db: Session, bot: TradingBot, current_user: User, *, confirm: bool) -> dict:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")
    if not confirm:
        raise ValueError("Position close requires confirm=true")
    result = close_bot_position(db, bot)
    db.commit()
    return result
