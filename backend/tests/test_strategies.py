"""Unit tests for indicators and strategies."""
import pytest

from app.bot_engine.data_loader import Candle
from app.bot_engine.indicators import rsi, simple_moving_average
from app.bot_engine.strategies.ma_crossover import MovingAverageCrossoverStrategy
from app.bot_engine.strategies.rsi_strategy import RSIStrategy


def _candles(prices: list[float]) -> list[Candle]:
    return [
        Candle(date=f"2024-01-{i + 1:02d}", open=p, high=p + 1, low=p - 1, close=p, volume=1000)
        for i, p in enumerate(prices)
    ]


# Indicators --------------------------------------------------------------


def test_sma_returns_none_before_window_fills():
    assert simple_moving_average([1, 2, 3, 4], 3) == [None, None, 2.0, 3.0]


def test_sma_rejects_invalid_window():
    with pytest.raises(ValueError):
        simple_moving_average([1, 2, 3], 0)


def test_rsi_returns_none_during_warmup():
    values = list(range(1, 30))
    series = rsi(values, period=14)
    assert series[:14] == [None] * 14
    assert all(v is not None for v in series[14:])


def test_rsi_reaches_100_on_constant_growth():
    series = rsi([float(i) for i in range(1, 50)], period=14)
    # Pure up-only series gives RSI ≈ 100.
    assert series[-1] == pytest.approx(100.0, abs=0.01)


# Strategies --------------------------------------------------------------


def test_ma_crossover_generates_buy_and_sell():
    prices = [10, 10, 10, 10, 10, 12, 14, 18, 22, 25, 20, 14, 9, 6, 5, 7, 11, 16]
    strat = MovingAverageCrossoverStrategy(fast_window=3, slow_window=6)
    signals = strat.generate_signals(_candles(prices))
    assert len(signals) == len(prices)
    assert "buy" in signals
    assert "sell" in signals


def test_ma_crossover_validates_windows():
    with pytest.raises(ValueError):
        MovingAverageCrossoverStrategy(fast_window=20, slow_window=10)


def test_rsi_strategy_emits_signals_on_threshold_cross():
    # Drop then recovery should generate a buy after the oversold zone.
    prices = [100] * 14 + [90, 80, 70, 60, 50, 60, 70, 80, 90, 100, 110, 120, 130]
    signals = RSIStrategy(rsi_period=14, oversold=30, overbought=70).generate_signals(
        _candles(prices)
    )
    assert "buy" in signals or "sell" in signals


def test_rsi_validates_thresholds():
    with pytest.raises(ValueError):
        RSIStrategy(rsi_period=14, oversold=70, overbought=30)
