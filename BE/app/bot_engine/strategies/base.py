"""Strategy abstract base."""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.bot_engine.data_loader import Candle

Signal = str  # "buy" | "sell" | "hold"


class Strategy(ABC):
    """A trading strategy maps a list of candles to a list of discrete signals.

    The signal at position `i` is the action to take after the close of candle `i`.
    """

    name: str = "base"
    display_name: str = "Strategy"

    @abstractmethod
    def generate_signals(self, candles: list[Candle]) -> list[Signal]:
        """Return list[str] same length as candles; one of: buy, sell, hold."""

    def to_params_dict(self) -> dict:
        """Serialise strategy parameters for persistence/display."""
        return {}
