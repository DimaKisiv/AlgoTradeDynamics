"""Schemas for emulator-driven bot backtests."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

PathMode = Literal["conservative", "ohlc", "olhc", "close"]
EndBehavior = Literal["keep_open", "force_close"]


class BacktestCreate(BaseModel):
    bot_id: int
    dataset_id: int = Field(gt=0)
    start_time: int
    end_time: int
    initial_balance: float = Field(default=10_000, gt=0)
    fee_rate: float = Field(default=0.0002, ge=0, le=0.1)
    slippage_percent: float = Field(default=0, ge=0, le=10)
    path_mode: PathMode = "conservative"
    end_behavior: EndBehavior = "keep_open"
    name: str | None = Field(default=None, max_length=180)


class BacktestRunSummary(BaseModel):
    id: int
    source_bot_id: int | None
    name: str
    bot_name: str
    symbol: str
    dataset_id: int | None
    dataset_name: str | None
    interval: str
    start_time: int
    end_time: int
    initial_balance: float
    status: str
    progress: float
    processed_candles: int
    total_candles: int
    current_time: int | None
    current_price: float | None
    metrics: dict[str, Any]
    error: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class BacktestRunDetail(BacktestRunSummary):
    temp_bot_id: int | None
    emulator_account_id: int | None
    fee_rate: float
    slippage_percent: float
    path_mode: str
    end_behavior: str
    pause_requested: bool
    cancel_requested: bool
    bot_snapshot: dict[str, Any]
    configuration: dict[str, Any]
    updated_at: datetime


class BacktestPointResponse(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    balance: float
    equity: float
    available_balance: float
    unrealized_pnl: float
    position_qty: float
    position_value: float
    drawdown_percent: float

    model_config = ConfigDict(from_attributes=True)


class BacktestCycleResponse(BaseModel):
    id: int
    cycle_number: int
    started_at_ms: int
    closed_at_ms: int | None
    duration_seconds: float
    time_in_loss_seconds: float
    max_unrealized_loss: float
    max_position_qty: float
    max_position_value: float
    entries_filled: int
    avg_entry_price: float | None
    exit_price: float | None
    gross_pnl: float
    fees: float
    net_pnl: float
    status: str
    details: dict[str, Any]

    model_config = ConfigDict(from_attributes=True)


class HistoricalDatasetResponse(BaseModel):
    id: int
    name: str
    exchange: str
    category: str
    symbol: str
    interval: str
    source_file: str | None = None
    candles: int
    from_time: int | None
    to_time: int | None
    requested_start_time: int | None = None
    requested_end_time: int | None = None
    expected_candles: int = 0
    missing_candles: int = 0
    status: str = "ready"
    quality: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
