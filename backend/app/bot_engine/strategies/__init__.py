"""Trading strategy registry."""
from app.bot_engine.strategies.base import Strategy
from app.bot_engine.strategies.ma_crossover import MovingAverageCrossoverStrategy
from app.bot_engine.strategies.rsi_strategy import RSIStrategy

__all__ = ["Strategy", "MovingAverageCrossoverStrategy", "RSIStrategy", "STRATEGIES", "get_strategy"]


STRATEGIES: dict[str, dict] = {
    "ma_crossover": {
        "id": "ma_crossover",
        "name": "Moving Average Crossover",
        "description": (
            "Класична трендова стратегія: купуємо коли швидка ковзна середня перетинає "
            "повільну знизу вгору, продаємо коли перетинає згори вниз."
        ),
        "parameters": [
            {"name": "fast_window", "label": "Fast MA", "type": "int",
             "default": 10, "min": 2, "max": 100, "step": 1, "unit": ""},
            {"name": "slow_window", "label": "Slow MA", "type": "int",
             "default": 30, "min": 3, "max": 250, "step": 1, "unit": ""},
        ],
    },
    "rsi": {
        "id": "rsi",
        "name": "RSI Mean Reversion",
        "description": (
            "Контр-трендова стратегія на основі RSI: купуємо при виході з зони перепроданості, "
            "закриваємо позицію при досягненні зони перекупленості."
        ),
        "parameters": [
            {"name": "rsi_period", "label": "RSI Period", "type": "int",
             "default": 14, "min": 2, "max": 60, "step": 1, "unit": ""},
            {"name": "oversold", "label": "Oversold Threshold", "type": "float",
             "default": 30, "min": 5, "max": 45, "step": 1, "unit": ""},
            {"name": "overbought", "label": "Overbought Threshold", "type": "float",
             "default": 70, "min": 55, "max": 95, "step": 1, "unit": ""},
        ],
    },
}


def get_strategy(strategy_id: str, params: dict) -> Strategy:
    """Factory that builds a strategy instance from id and parameters."""
    if strategy_id == "ma_crossover":
        return MovingAverageCrossoverStrategy(
            fast_window=int(params.get("fast_window", 10)),
            slow_window=int(params.get("slow_window", 30)),
        )
    if strategy_id == "rsi":
        return RSIStrategy(
            rsi_period=int(params.get("rsi_period", 14)),
            oversold=float(params.get("oversold", 30)),
            overbought=float(params.get("overbought", 70)),
        )
    raise ValueError(f"Unknown strategy: {strategy_id}")
