"""Operational observability and incident records.

These records are intentionally mutable/retention-bound, unlike the immutable
regulatory audit ledger.  They answer "is the platform healthy and what failed?"
rather than "what financial/user action occurred?".
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)
    level: Mapped[str] = mapped_column(String(20), default="INFO", nullable=False, index=True)
    service: Mapped[str] = mapped_column(String(40), default="API", nullable=False, index=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    correlation_id: Mapped[str | None] = mapped_column(String(180), nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    bot_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    method: Mapped[str | None] = mapped_column(String(10), nullable=True)
    path: Mapped[str | None] = mapped_column(String(300), nullable=True, index=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    duration_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    exchange: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    error_type: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    message: Mapped[str] = mapped_column(String(1000), nullable=False)
    retention_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    retention_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    bot_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source_event_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    correlation_id: Mapped[str | None] = mapped_column(String(180), nullable=True, index=True)

    severity: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    incident_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_taken: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
