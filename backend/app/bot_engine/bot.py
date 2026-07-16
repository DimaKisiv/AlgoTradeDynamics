"""Bot runtime orchestration helpers retained for service compatibility."""
from __future__ import annotations

from datetime import datetime, timezone

from app.bot_engine.events import log_bot_event
from app.bot_engine.grid_runtime import cancel_all_bot_orders, ensure_live_trading_allowed, sync_bot_orders, tick_grid_bot
from app.models.trading_bot import TradingBot
from app.models.trading_bot_order import TradingBotOrder
from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def run_grid_bot_once(db, bot: TradingBot, current_user: User) -> dict:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")
    if not bot.is_active:
        raise ValueError("Trading bot is inactive")
    live_message = ensure_live_trading_allowed(db, bot)
    if live_message is not None:
        raise ValueError(live_message)

    bot.runtime_status = "running"
    bot.started_at = bot.started_at or _utcnow()
    bot.stopped_at = None
    bot.last_error = None
    db.add(bot)
    log_bot_event(db, bot, "bot_started", "Bot marked as running")
    db.commit()
    db.refresh(bot)

    return {
        "bot": bot,
        "orders": [],
        "action": "STARTED",
        "message": "Bot worker started",
    }


def stop_grid_bot_once(db, bot: TradingBot, current_user: User, *, cancel_open: bool = True) -> TradingBot:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")

    should_cancel = bool((bot.settings or {}).get(
        "cancel_orders_on_stop", True))
    if cancel_open and should_cancel:
        cancel_all_bot_orders(db, bot)

    bot.runtime_status = "stopped"
    bot.stopped_at = _utcnow()
    bot.last_error = None
    db.add(bot)
    log_bot_event(db, bot, "bot_stopped", "Bot stopped")
    db.commit()
    db.refresh(bot)
    return bot


def sync_grid_bot_orders(db, bot: TradingBot, current_user: User) -> list[TradingBotOrder]:
    if bot.user_id != current_user.id:
        raise PermissionError("Trading bot access denied")

    changes = sync_bot_orders(db, bot)

    bot.last_run_at = _utcnow()
    bot.last_error = None
    db.add(bot)
    db.commit()

    return [change["order"] for change in changes]


def tick_grid_bot_once(db, bot: TradingBot) -> dict:
    return tick_grid_bot(db, bot)
