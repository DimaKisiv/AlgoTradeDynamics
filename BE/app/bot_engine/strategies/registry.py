"""Central registry for all supported bot strategies."""
from __future__ import annotations

from app.bot_engine.strategies.base import BotStrategy
from app.bot_engine.strategies.dca import DcaStrategy
from app.bot_engine.strategies.grid import GridStrategy
from app.bot_engine.strategies.pattern_scalper import PatternScalperStrategy

_STRATEGIES: dict[str, BotStrategy] = {
    "grid": GridStrategy(),
    "dca": DcaStrategy(),
    "pattern_scalper": PatternScalperStrategy(),
}


def get_strategy(strategy_type: str) -> BotStrategy:
    strategy = _STRATEGIES.get(str(strategy_type or "").lower())
    if strategy is None:
        raise ValueError(f"Unsupported bot strategy: {strategy_type}")
    return strategy


def supported_strategy_types() -> tuple[str, ...]:
    return tuple(_STRATEGIES)
