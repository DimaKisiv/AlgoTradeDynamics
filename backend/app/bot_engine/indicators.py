"""Pure-python technical indicators used by trading strategies."""
from __future__ import annotations


def simple_moving_average(values: list[float], window: int) -> list[float | None]:
    """Return SMA series with `None` placeholders before the window fills up."""
    if window <= 0:
        raise ValueError("SMA window must be positive")
    if window > len(values):
        return [None] * len(values)

    result: list[float | None] = [None] * len(values)
    window_sum = sum(values[:window])
    result[window - 1] = window_sum / window
    for index in range(window, len(values)):
        window_sum += values[index] - values[index - window]
        result[index] = window_sum / window
    return result


def rsi(values: list[float], period: int = 14) -> list[float | None]:
    """Relative Strength Index using Wilder smoothing.

    Returns a series the same length as `values`, with `None` for entries
    where there is not enough history to compute RSI yet.
    """
    if period <= 1:
        raise ValueError("RSI period must be > 1")
    if len(values) <= period:
        return [None] * len(values)

    gains: list[float] = []
    losses: list[float] = []
    for i in range(1, len(values)):
        change = values[i] - values[i - 1]
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))

    result: list[float | None] = [None] * len(values)

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    def _rsi_from(g: float, l: float) -> float:
        if l == 0:
            return 100.0
        rs = g / l
        return 100.0 - (100.0 / (1.0 + rs))

    result[period] = _rsi_from(avg_gain, avg_loss)

    for i in range(period + 1, len(values)):
        gain = gains[i - 1]
        loss = losses[i - 1]
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        result[i] = _rsi_from(avg_gain, avg_loss)

    return result
