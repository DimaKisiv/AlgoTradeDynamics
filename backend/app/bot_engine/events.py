"""Helpers for trading bot runtime event logging."""
from __future__ import annotations

from app.models.trading_bot import TradingBot
from app.models.trading_bot_event import TradingBotEvent


def log_bot_event(db, bot: TradingBot, event_type: str, message: str, payload: dict | None = None) -> TradingBotEvent:
    event = TradingBotEvent(
        bot_id=bot.id,
        user_id=bot.user_id,
        event_type=event_type,
        message=message,
        payload=payload,
    )
    db.add(event)
    db.flush()
    return event
