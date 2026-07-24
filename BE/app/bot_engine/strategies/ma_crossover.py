"""Moving Average Crossover strategy."""
from __future__ import annotations

from app.bot_engine.data_loader import Candle
from app.bot_engine.indicators import simple_moving_average
from app.bot_engine.strategies.base import Signal, Strategy


class MovingAverageCrossoverStrategy(Strategy):
    """Classic trend-following MA crossover.

    Generates a `buy` signal on a bullish crossover (fast crosses above slow)
    and a `sell` signal on a bearish crossover.
    """

    name = "ma_crossover"
    display_name = "Moving Average Crossover"

    def __init__(self, fast_window: int = 10, slow_window: int = 30) -> None:
        if fast_window <= 0 or slow_window <= 0:
            raise ValueError("Windows must be positive")
        if fast_window >= slow_window:
            raise ValueError("fast_window must be smaller than slow_window")
        self.fast_window = fast_window
        self.slow_window = slow_window

    def to_params_dict(self) -> dict:
        return {"fast_window": self.fast_window, "slow_window": self.slow_window}

    def generate_signals(self, candles: list[Candle]) -> list[Signal]:
        closes = [c.close for c in candles]
        fast = simple_moving_average(closes, self.fast_window)
        slow = simple_moving_average(closes, self.slow_window)

        signals: list[Signal] = ["hold"] * len(candles)
        for i in range(1, len(candles)):
            pf, ps, cf, cs = fast[i - 1], slow[i - 1], fast[i], slow[i]
            if None in (pf, ps, cf, cs):
                continue
            if pf <= ps and cf > cs:
                signals[i] = "buy"
            elif pf >= ps and cf < cs:
                signals[i] = "sell"
        return signals
