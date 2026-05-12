"""RSI mean-reversion strategy."""
from __future__ import annotations

from app.bot_engine.data_loader import Candle
from app.bot_engine.indicators import rsi
from app.bot_engine.strategies.base import Signal, Strategy


class RSIStrategy(Strategy):
    """RSI-based mean-reversion strategy.

    Buys when RSI exits the oversold zone (crosses above `oversold`), sells when
    it enters the overbought zone (crosses above `overbought`).
    """

    name = "rsi"
    display_name = "RSI Mean Reversion"

    def __init__(
        self, rsi_period: int = 14, oversold: float = 30.0, overbought: float = 70.0
    ) -> None:
        if oversold >= overbought:
            raise ValueError("oversold must be smaller than overbought")
        self.rsi_period = rsi_period
        self.oversold = oversold
        self.overbought = overbought

    def to_params_dict(self) -> dict:
        return {
            "rsi_period": self.rsi_period,
            "oversold": self.oversold,
            "overbought": self.overbought,
        }

    def generate_signals(self, candles: list[Candle]) -> list[Signal]:
        closes = [c.close for c in candles]
        series = rsi(closes, period=self.rsi_period)

        signals: list[Signal] = ["hold"] * len(candles)
        for i in range(1, len(candles)):
            prev, curr = series[i - 1], series[i]
            if prev is None or curr is None:
                continue
            if prev <= self.oversold < curr:
                signals[i] = "buy"
            elif prev < self.overbought <= curr:
                signals[i] = "sell"
        return signals
