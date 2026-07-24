"""Backtester behaviour tests."""
import pytest

from app.bot_engine.backtester import Backtester
from app.bot_engine.data_loader import Candle, load_candles
from app.bot_engine.strategies.base import Strategy
from app.bot_engine.strategies.ma_crossover import MovingAverageCrossoverStrategy


def _candles(prices: list[float]) -> list[Candle]:
    return [
        Candle(date=f"2024-01-{i + 1:02d}", open=p, high=p + 1, low=p - 1, close=p, volume=1000)
        for i, p in enumerate(prices)
    ]


class BuyOnceStrategy(Strategy):
    """Stub strategy: emits a single buy signal at a fixed index."""
    name = "buy_once"
    display_name = "Buy-once Test Strategy"

    def __init__(self, buy_index: int) -> None:
        self.buy_index = buy_index

    def generate_signals(self, candles):
        signals = ["hold"] * len(candles)
        if 0 <= self.buy_index < len(candles):
            signals[self.buy_index] = "buy"
        return signals


def test_backtester_runs_on_real_dataset():
    candles = load_candles("data/btc_usdt_2024.csv")
    result = Backtester(
        strategy=MovingAverageCrossoverStrategy(fast_window=10, slow_window=30),
        candles=candles,
        initial_balance=10_000,
        position_size_percent=20,
        stop_loss_percent=5,
        max_drawdown_percent=25,
    ).run()

    assert result.initial_balance == 10_000
    assert result.trades_count == len(result.trades)
    assert len(result.equity_points) > 0
    assert result.strategy_name == "Moving Average Crossover"


def test_stop_loss_closes_position():
    # Enter at index 2 (price 100), then a sharp drop triggers the 5% stop-loss.
    prices = [100, 100, 100, 100, 90, 80]
    result = Backtester(
        strategy=BuyOnceStrategy(buy_index=2),
        candles=_candles(prices),
        initial_balance=10_000,
        position_size_percent=50,
        stop_loss_percent=5,
        max_drawdown_percent=80,
    ).run()

    assert any(t.reason == "Stop-loss" for t in result.trades)


def test_max_drawdown_halts_trading():
    # Enter at index 1 (price 100); price collapses well past 15% drawdown.
    prices = [100, 100, 100, 80, 50, 30, 10]
    result = Backtester(
        strategy=BuyOnceStrategy(buy_index=1),
        candles=_candles(prices),
        initial_balance=10_000,
        position_size_percent=100,
        stop_loss_percent=99,
        max_drawdown_percent=15,
    ).run()

    assert result.max_drawdown_percent >= 15
    assert any(t.reason == "Max drawdown limit" for t in result.trades)


def test_backtester_rejects_empty_dataset():
    with pytest.raises(ValueError):
        Backtester(
            strategy=MovingAverageCrossoverStrategy(),
            candles=[],
            initial_balance=10_000,
        )
