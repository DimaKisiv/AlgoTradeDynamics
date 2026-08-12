"""Immutable compliance-oriented audit trail records.

Audit records intentionally do not use foreign keys to operational tables.  A bot,
user, order or ordinary runtime event may be deleted as part of normal product
retention, while the regulatory trail must preserve the original identifiers.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, Float, Integer, String, event
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)

    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    bot_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source_event_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)

    actor_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    actor_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    message: Mapped[str] = mapped_column(String(500), nullable=False)

    exchange: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    environment: Mapped[str | None] = mapped_column(String(20), nullable=True)
    symbol: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)

    order_link_id: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    exchange_order_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    side: Mapped[str | None] = mapped_column(String(10), nullable=True)
    order_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    order_role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    filled_quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    fee: Mapped[float | None] = mapped_column(Float, nullable=True)
    realized_pnl: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)

    correlation_id: Mapped[str | None] = mapped_column(String(180), nullable=True, index=True)
    strategy_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    strategy_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    config_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    error_type: Mapped[str | None] = mapped_column(String(40), nullable=True)

    payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    jurisdiction: Mapped[str] = mapped_column(String(40), nullable=False, default="EU")
    retention_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    previous_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    event_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)


@event.listens_for(AuditEvent, "before_update")
def _audit_update_guard(*_args, **_kwargs) -> None:
    raise ValueError("audit_events is append-only; existing records cannot be updated")


@event.listens_for(AuditEvent, "before_delete")
def _audit_delete_guard(*_args, **_kwargs) -> None:
    raise ValueError("audit_events is append-only; existing records cannot be deleted")
