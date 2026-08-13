"""Adapter exposing the DCA runtime as a strategy."""
from __future__ import annotations

from app.bot_engine.dca_runtime import (
    get_dca_risk_summary,
    get_effective_dca_settings,
    tick_dca_bot,
    validate_dca_configuration,
)
from app.bot_engine.grid_runtime import (
    cancel_all_bot_orders,
    close_bot_position,
    ensure_live_trading_allowed,
    get_position_snapshot,
    get_runtime_state,
    sync_bot_orders,
)
from app.models.trading_bot import TradingBot


class DcaStrategy:
    strategy_type = "dca"

    def get_effective_settings(self, bot: TradingBot) -> dict:
        return get_effective_dca_settings(bot)

    def get_runtime_state(self, db, bot: TradingBot) -> tuple[str, str | None]:
        return get_runtime_state(db, bot)

    def validate_start(self, db, bot: TradingBot) -> None:
        message = ensure_live_trading_allowed(db, bot)
        if message:
            raise ValueError(message)
        validate_dca_configuration(bot)

    def tick(self, db, bot: TradingBot, *, force: bool = False) -> dict:
        return tick_dca_bot(db, bot, force=force)

    def sync_orders(self, db, bot: TradingBot) -> list:
        return [change["order"] for change in sync_bot_orders(db, bot)]

    def cancel_orders(self, db, bot: TradingBot) -> list:
        return cancel_all_bot_orders(db, bot)

    def get_position(self, db, bot: TradingBot) -> dict:
        return get_position_snapshot(db, bot)

    def get_risk(self, db, bot: TradingBot) -> dict:
        return get_dca_risk_summary(db, bot)

    def close_position(self, db, bot: TradingBot) -> dict:
        return close_bot_position(db, bot)
