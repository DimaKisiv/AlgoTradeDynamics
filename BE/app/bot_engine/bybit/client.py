"""Bybit client factory for bot runtime operations."""
from __future__ import annotations

import os

from pybit.unified_trading import HTTP

from app.models.trading_bot import TradingBot


def _load_credentials(environment: str) -> tuple[str | None, str | None]:
    env_key = environment.upper()
    api_key = os.getenv(f"BYBIT_{env_key}_API_KEY")
    api_secret = os.getenv(f"BYBIT_{env_key}_API_SECRET")

    if environment == "demo":
        api_key = api_key or os.getenv("BYBIT_DEMO_API_KEY")
        api_secret = api_secret or os.getenv("BYBIT_DEMO_API_SECRET")

    return api_key, api_secret


def get_bybit_session(bot: TradingBot) -> HTTP:
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
