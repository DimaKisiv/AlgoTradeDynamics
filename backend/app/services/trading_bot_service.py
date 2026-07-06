"""Service layer for user-owned trading bot CRUD operations."""
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.bot_engine.bot import run_grid_bot_once, stop_grid_bot_once, sync_grid_bot_orders
from app.models.trading_bot import TradingBot
from app.models.trading_bot_order import TradingBotOrder
from app.models.user import User
from app.schemas.trading_bot import TradingBotCreate, TradingBotUpdate


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


def start_trading_bot_cycle(db: Session, bot: TradingBot, current_user: User) -> dict:
    return run_grid_bot_once(db, bot, current_user)


def stop_trading_bot_cycle(db: Session, bot: TradingBot, current_user: User) -> TradingBot:
    return stop_grid_bot_once(db, bot, current_user)


def sync_trading_bot_orders(db: Session, bot: TradingBot, current_user: User) -> list[TradingBotOrder]:
    return sync_grid_bot_orders(db, bot, current_user)
