"""Bybit client factory for bot runtime operations."""
from __future__ import annotations

import os

try:
    from pybit.unified_trading import HTTP
except ImportError:  # Allows emulator-only development without pybit installed.
    HTTP = None  # type: ignore[assignment]

from app.models.trading_bot import TradingBot
from app.core.config import get_settings
from app.bot_engine.bybit.emulator_client import EmulatorHTTP


def _load_credentials(environment: str) -> tuple[str | None, str | None]:
    env_key = environment.upper()
    api_key = os.getenv(f"BYBIT_{env_key}_API_KEY")
    api_secret = os.getenv(f"BYBIT_{env_key}_API_SECRET")

    if environment == "demo":
        api_key = api_key or os.getenv("BYBIT_DEMO_API_KEY")
        api_secret = api_secret or os.getenv("BYBIT_DEMO_API_SECRET")

    return api_key, api_secret


def get_bybit_session(bot: TradingBot):
    if bot.environment == "emulator":
        settings = get_settings()
        bot_settings = bot.settings or {}
        api_key = str(
            bot_settings.get("emulator_api_key")
            or settings.exchange_emulator_default_api_key
        )
        return EmulatorHTTP(
            base_url=settings.exchange_emulator_url,
            api_key=api_key,
        )

    if HTTP is None:
        raise RuntimeError("pybit is required for Bybit demo, testnet, or live environments")

    api_key, api_secret = _load_credentials(bot.environment)
    if not api_key or not api_secret:
        raise ValueError(
            f"Bybit {bot.environment} API credentials are not configured")

    kwargs = {
        "api_key": api_key,
        "api_secret": api_secret,
    }
    if bot.environment == "demo":
        kwargs["demo"] = True
    elif bot.environment == "testnet":
        kwargs["testnet"] = True

    return HTTP(**kwargs)
