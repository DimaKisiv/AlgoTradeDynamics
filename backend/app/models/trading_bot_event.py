"""ORM model for bot runtime event logs."""
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.trading_bot import TradingBot
    from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TradingBotEvent(Base):
    __tablename__ = "trading_bot_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bot_id: Mapped[int] = mapped_column(
        ForeignKey("trading_bots.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )

    bot: Mapped["TradingBot"] = relationship(
        "TradingBot", back_populates="events")
    user: Mapped["User"] = relationship(
        "User", back_populates="trading_bot_events")
