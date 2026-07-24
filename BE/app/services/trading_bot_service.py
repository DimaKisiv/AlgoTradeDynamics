"""Service layer for user-owned trading bot CRUD operations."""
from datetime import datetime, timezone

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.bot_engine.bot import run_grid_bot_once, stop_grid_bot_once, sync_grid_bot_orders, sync_bot_orders
from app.bot_engine.grid_runtime import cancel_all_bot_orders
from app.models.trading_bot import TradingBot
from app.models.trading_bot_event import TradingBotEvent
from app.models.trading_bot_order import TradingBotOrder
from app.models.user import User
from app.schemas.trading_bot import TradingBotCreate, TradingBotUpdate


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def list_trading_bots(db: Session, user_id: int, limit: int = 100) -> list[TradingBot]:
    return (
        db.query(TradingBot)
        .filter(TradingBot.user_id == user_id)
        .order_by(desc(TradingBot.updated_at), desc(TradingBot.id))
        .limit(limit)
        .all()
    )


def get_trading_bot(db: Session, bot_id: int, user_id: int) -> TradingBot | None:
    return (
        db.query(TradingBot)
        .filter(TradingBot.id == bot_id, TradingBot.user_id == user_id)
        .first()
    )


def create_trading_bot(db: Session, payload: TradingBotCreate, user_id: int) -> TradingBot:
    bot = TradingBot(user_id=user_id, **payload.model_dump())
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return bot


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
    return bot


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
    return run_grid_bot_once(db, bot, current_user)


def stop_trading_bot_cycle(db: Session, bot: TradingBot, current_user: User) -> TradingBot:
    return stop_grid_bot_once(db, bot, current_user)


def sync_trading_bot_orders(db: Session, bot: TradingBot, current_user: User) -> list[TradingBotOrder]:
    return sync_grid_bot_orders(db, bot, current_user)


def cancel_trading_bot_orders(db: Session, bot: TradingBot, current_user: User) -> list[TradingBotOrder]:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")
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
