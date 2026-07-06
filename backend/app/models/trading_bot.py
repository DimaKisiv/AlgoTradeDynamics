"""ORM model for user-owned trading bot configurations."""
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.trading_bot_order import TradingBotOrder
    from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TradingBot(Base):
    __tablename__ = "trading_bots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    exchange: Mapped[str] = mapped_column(
        String(40), default="bybit", nullable=False)
    environment: Mapped[str] = mapped_column(
        String(20), default="demo", nullable=False)
    strategy_type: Mapped[str] = mapped_column(
        String(40), default="grid", nullable=False)
    category: Mapped[str] = mapped_column(
        String(20), default="linear", nullable=False)
    symbol: Mapped[str] = mapped_column(
        String(30), default="BTCUSDT", nullable=False)
    order_qty: Mapped[float] = mapped_column(
        Float, default=0.001, nullable=False)
    grid_orders_count: Mapped[int] = mapped_column(
        Integer, default=2, nullable=False)
    grid_step_percent: Mapped[float] = mapped_column(
        Float, default=5, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False)
    runtime_status: Mapped[str] = mapped_column(
        String(20), default="stopped", nullable=False
    )
    settings: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)
    stopped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)
    last_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="trading_bots")
    orders: Mapped[list["TradingBotOrder"]] = relationship(
        "TradingBotOrder", back_populates="bot", cascade="all, delete-orphan"
    )
