"""ORM model for application users."""
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:  # уникаємо циклічного імпорту, тип потрібен лише статичному аналізатору
    from app.models.backtest import BacktestRun
    from app.models.trading_bot import TradingBot
    from app.models.trading_bot_event import TradingBotEvent
    from app.models.trading_bot_order import TradingBotOrder


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    runs: Mapped[list["BacktestRun"]] = relationship(
        "BacktestRun", back_populates="user", cascade="all, delete-orphan"
    )
    trading_bots: Mapped[list["TradingBot"]] = relationship(
        "TradingBot", back_populates="user", cascade="all, delete-orphan"
    )
    trading_bot_orders: Mapped[list["TradingBotOrder"]] = relationship(
        "TradingBotOrder", back_populates="user", cascade="all, delete-orphan"
    )
    trading_bot_events: Mapped[list["TradingBotEvent"]] = relationship(
        "TradingBotEvent", back_populates="user", cascade="all, delete-orphan"
    )
