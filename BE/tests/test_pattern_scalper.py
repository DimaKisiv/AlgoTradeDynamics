from math import sin

from app.bot_engine.strategies.pattern_scalper import Candle, _signal


SETTINGS = {
    "ema_fast_period": 20,
    "ema_slow_period": 50,
    "rsi_period": 14,
    "atr_period": 14,
    "breakout_lookback": 20,
    "volume_lookback": 20,
    "volume_multiplier": 1.2,
    "minimum_signal_score": 0.70,
    "rsi_long_min": 50,
    "rsi_long_max": 72,
    "rsi_short_min": 28,
    "rsi_short_max": 50,
    "allow_short": True,
}


def _trend_candles(direction: int) -> list[Candle]:
    candles = []
    base = 100 if direction > 0 else 110
    for index in range(60):
        close = base + direction * index * 0.08 + sin(index * 1.7) * 0.35
        open_price = close - direction * (0.15 if index % 2 == 0 else -0.08)
        candles.append(Candle(
            open_time=index * 300_000,
            open=open_price,
            high=max(open_price, close) + 0.2,
            low=min(open_price, close) - 0.2,
            close=close,
            volume=100,
        ))

    latest = candles[-1]
    if direction > 0:
        breakout = max(item.high for item in candles[-21:-1]) + 0.25
        candles[-1] = Candle(latest.open_time, breakout - 0.5, breakout + 0.1, breakout - 0.6, breakout, 180)
    else:
        breakout = min(item.low for item in candles[-21:-1]) - 0.25
        candles[-1] = Candle(latest.open_time, breakout + 0.5, breakout + 0.6, breakout - 0.1, breakout, 180)
    return candles


def test_pattern_scalper_detects_long_breakout():
    signal = _signal(_trend_candles(1), SETTINGS)
    assert signal is not None
    assert signal.side == "Buy"
    assert signal.score >= SETTINGS["minimum_signal_score"]
    assert signal.atr > 0


def test_pattern_scalper_detects_short_breakout():
    signal = _signal(_trend_candles(-1), SETTINGS)
    assert signal is not None
    assert signal.side == "Sell"
    assert signal.score >= SETTINGS["minimum_signal_score"]
    assert signal.atr > 0
