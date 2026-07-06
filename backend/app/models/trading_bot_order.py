"""ORM model for persisted exchange orders created by trading bots."""
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.trading_bot import TradingBot
    from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TradingBotOrder(Base):
    __tablename__ = "trading_bot_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bot_id: Mapped[int] = mapped_column(
        ForeignKey("trading_bots.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    exchange: Mapped[str] = mapped_column(String(40), nullable=False)
    environment: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    symbol: Mapped[str] = mapped_column(String(30), nullable=False)
    side: Mapped[str] = mapped_column(String(10), nullable=False)
    order_type: Mapped[str] = mapped_column(String(20), nullable=False)
    order_role: Mapped[str] = mapped_column(String(50), nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    exchange_order_id: Mapped[str | None] = mapped_column(
        String(120), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="New")
    raw_response: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    bot: Mapped["TradingBot"] = relationship(
        "TradingBot", back_populates="orders")
    user: Mapped["User"] = relationship(
        "User", back_populates="trading_bot_orders")
