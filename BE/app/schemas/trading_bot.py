"""Pydantic schemas for trading bot CRUD endpoints."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


ExchangeLiteral = Literal["bybit"]
EnvironmentLiteral = Literal["emulator", "demo", "testnet", "live"]
StrategyTypeLiteral = Literal["grid", "pattern_scalper"]
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
    order_link_generation: int
    runtime_status: str
    runtime_state: str | None = None
    last_risk_message: str | None = None
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    stopped_at: datetime | None
    last_run_at: datetime | None
    last_error: str | None
    last_error_type: str | None = None
    last_error_severity: str | None = None
    last_error_action: str | None = None
    last_error_code: str | None = None
    last_error_at: datetime | None = None
    error_retry_count: int = 0
    next_retry_at: datetime | None = None

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
    order_link_id: str | None
    qty: float
    filled_qty: float
    price: float | None
    exchange_order_id: str | None
    parent_order_id: int | None
    status: str
    raw_response: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TradingBotEventResponse(BaseModel):
    id: int
    bot_id: int
    user_id: int
    event_type: str
    message: str
    payload: dict[str, Any] | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TradingBotRunResponse(BaseModel):
    bot: TradingBotResponse
    orders: list[TradingBotOrderResponse]
    action: str
    message: str


class TradingBotClearHistoryResponse(BaseModel):
    message: str
    bot_id: int
    orders_deleted: int
    events_deleted: int
    exchange_orders_cancelled: int
    exchange_cancel_error: str | None = None


class TradingBotPositionTakeProfitResponse(BaseModel):
    order_id: str | None
    order_link_id: str | None
    price: str | None
    qty: str | None
    status: str | None
    reduce_only: bool


class TradingBotPositionResponse(BaseModel):
    symbol: str
    category: str
    side: str | None
    size: str
    avg_entry_price: str | None
    mark_price: str | None
    liq_price: str | None = None
    unrealized_pnl: str | None = None
    unrealized_pnl_percent: str | None = None
    leverage: str | None = None
    margin_mode: str | None = None
    position_value: str | None = None
    take_profit: TradingBotPositionTakeProfitResponse | None = None


class TradingBotRiskResponse(BaseModel):
    max_position_qty: str | None
    current_position_qty: str | None
    pending_buy_qty: str | None
    potential_total_qty: str | None
    max_open_orders: int
    current_open_orders: int
    max_notional_usdt: str | None
    estimated_notional_usdt: str | None
    allow_live_trading: bool
    is_live_environment: bool
    blocked: bool
    reason: str | None


class TradingBotPerformanceResponse(BaseModel):
    closed_cycles: int
    winning_cycles: int
    win_rate_percent: str | None
    gross_realized_pnl: str | None
    closed_fees: str | None
    total_fees: str | None
    net_realized_pnl: str | None
    realized_pnl_percent: str | None
    average_cycle_pnl: str | None
    unrealized_pnl: str | None
    total_pnl: str | None
    total_pnl_percent: str | None
    open_position_qty: str | None
    open_position_value: str | None
    total_buy_cost: str | None
    total_sell_value: str | None


class TradingBotClosePositionRequest(BaseModel):
    confirm: bool = False


class TradingBotClosePositionResponse(BaseModel):
    message: str
    order: TradingBotOrderResponse | None = None
