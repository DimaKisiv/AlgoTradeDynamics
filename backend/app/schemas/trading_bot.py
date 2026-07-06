"""Pydantic schemas for trading bot CRUD endpoints."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


ExchangeLiteral = Literal["bybit"]
EnvironmentLiteral = Literal["demo", "testnet", "live"]
StrategyTypeLiteral = Literal["grid"]
CategoryLiteral = Literal["linear", "spot", "inverse"]


class TradingBotBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    exchange: ExchangeLiteral = "bybit"
    environment: EnvironmentLiteral = "demo"
    strategy_type: StrategyTypeLiteral = "grid"
    category: CategoryLiteral = "linear"
    symbol: str = Field(default="BTCUSDT", min_length=2, max_length=30)
    order_qty: float = Field(default=0.001, gt=0)
    grid_orders_count: int = Field(default=2, ge=1, le=100)
    grid_step_percent: float = Field(default=5, gt=0, le=100)
    is_active: bool = True
    settings: dict[str, Any] = Field(default_factory=dict)


class TradingBotCreate(TradingBotBase):
    pass


class TradingBotUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    exchange: ExchangeLiteral | None = None
    environment: EnvironmentLiteral | None = None
    strategy_type: StrategyTypeLiteral | None = None
    category: CategoryLiteral | None = None
    symbol: str | None = Field(default=None, min_length=2, max_length=30)
    order_qty: float | None = Field(default=None, gt=0)
    grid_orders_count: int | None = Field(default=None, ge=1, le=100)
    grid_step_percent: float | None = Field(default=None, gt=0, le=100)
    is_active: bool | None = None
    settings: dict[str, Any] | None = None


class TradingBotResponse(TradingBotBase):
    id: int
    user_id: int
    runtime_status: str
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    stopped_at: datetime | None
    last_run_at: datetime | None
    last_error: str | None

    model_config = ConfigDict(from_attributes=True)


class TradingBotOrderResponse(BaseModel):
    id: int
    bot_id: int
    user_id: int
    exchange: str
    environment: str
    category: str
    symbol: str
    side: str
    order_type: str
    order_role: str
    qty: float
    price: float | None
    exchange_order_id: str | None
    status: str
    raw_response: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TradingBotRunResponse(BaseModel):
    bot: TradingBotResponse
    orders: list[TradingBotOrderResponse]
    action: str
    message: str
