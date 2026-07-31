
"""Pydantic schemas for backtest endpoints."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


SymbolLiteral = Literal["BTC/USDT", "ETH/USDT"]
StrategyId = Literal["ma_crossover", "rsi"]


class MACrossoverParams(BaseModel):
    fast_window: int = Field(default=10, ge=2, le=100)
    slow_window: int = Field(default=30, ge=3, le=250)


class RSIParams(BaseModel):
    rsi_period: int = Field(default=14, ge=2, le=60)
    oversold: float = Field(default=30, ge=5, le=45)
    overbought: float = Field(default=70, ge=55, le=95)


class RiskLimits(BaseModel):
    position_size_percent: float = Field(default=20, gt=0, le=100)
    stop_loss_percent: float = Field(default=5, gt=0, le=50)
    max_drawdown_percent: float = Field(default=20, gt=0, le=80)


class BacktestRequest(BaseModel):
    symbol: SymbolLiteral = "BTC/USDT"
    initial_balance: float = Field(default=10_000, gt=0)
    strategy: StrategyId = "ma_crossover"
    ma_params: MACrossoverParams = Field(default_factory=MACrossoverParams)
    rsi_params: RSIParams = Field(default_factory=RSIParams)
    risk: RiskLimits = Field(default_factory=RiskLimits)


class TradeResponse(BaseModel):
    id: int
    symbol: str
    side: str
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    quantity: float
    pnl: float
    pnl_percent: float
    reason: str

    model_config = ConfigDict(from_attributes=True)


class EquityPointResponse(BaseModel):
    date: str
    value: float

    model_config = ConfigDict(from_attributes=True)


class BacktestRunSummary(BaseModel):
    id: int
    symbol: str
    strategy_name: str
    initial_balance: float
    final_balance: float
    total_pnl: float
    total_pnl_percent: float
    max_drawdown_percent: float
    win_rate_percent: float
    trades_count: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BacktestRunResponse(BacktestRunSummary):
    strategy_params: dict[str, Any]
    risk_params: dict[str, Any]
    trades: list[TradeResponse] = []
    equity_points: list[EquityPointResponse] = []

    model_config = ConfigDict(from_attributes=True)
