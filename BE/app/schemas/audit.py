"""Schemas for the immutable compliance audit trail."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AuditEventResponse(BaseModel):
    id: int
    occurred_at: datetime
    recorded_at: datetime
    user_id: int | None
    bot_id: int | None
    source_event_id: int | None
    actor_type: str
    actor_label: str | None
    category: str
    event_type: str
    message: str
    exchange: str | None
    environment: str | None
    symbol: str | None
    order_link_id: str | None
    exchange_order_id: str | None
    side: str | None
    order_type: str | None
    order_role: str | None
    quantity: float | None
    filled_quantity: float | None
    price: float | None
    fee: float | None
    realized_pnl: float | None
    status: str | None
    correlation_id: str | None
    strategy_type: str | None
    strategy_version: str | None
    config_hash: str | None
    ip_address: str | None
    user_agent: str | None
    error_code: str | None
    error_type: str | None
    payload: dict[str, Any] | None
    jurisdiction: str
    retention_until: datetime
    previous_hash: str | None
    event_hash: str

    model_config = ConfigDict(from_attributes=True)


class AuditEventListResponse(BaseModel):
    items: list[AuditEventResponse]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total: int = Field(ge=0)
    pages: int = Field(ge=0)


class AuditIntegrityResponse(BaseModel):
    valid: bool
    checked_events: int
    first_invalid_event_id: int | None = None
    message: str
