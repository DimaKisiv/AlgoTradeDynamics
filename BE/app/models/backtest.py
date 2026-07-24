"""ORM models for backtest runs, trades and equity points."""
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:  # уникаємо циклічного імпорту
    from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    symbol: Mapped[str] = mapped_column(String(30), default="BTC/USDT")
    strategy_name: Mapped[str] = mapped_column(String(80))
    strategy_params: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    risk_params: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    initial_balance: Mapped[float] = mapped_column(Float, default=10_000)
    final_balance: Mapped[float] = mapped_column(Float, default=0)
    total_pnl: Mapped[float] = mapped_column(Float, default=0)
    total_pnl_percent: Mapped[float] = mapped_column(Float, default=0)
    max_drawdown_percent: Mapped[float] = mapped_column(Float, default=0)
    win_rate_percent: Mapped[float] = mapped_column(Float, default=0)
    trades_count: Mapped[int] = mapped_column(Integer, default=0)

    status: Mapped[str] = mapped_column(String(30), default="completed")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )

    user: Mapped["User"] = relationship("User", back_populates="runs")

    trades: Mapped[list["Trade"]] = relationship(
        "Trade", back_populates="run", cascade="all, delete-orphan"
    )
    equity_points: Mapped[list["EquityPoint"]] = relationship(
        "EquityPoint", back_populates="run", cascade="all, delete-orphan"
    )


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("backtest_runs.id", ondelete="CASCADE"), index=True
    )
    symbol: Mapped[str] = mapped_column(String(30), default="BTC/USDT")
    side: Mapped[str] = mapped_column(String(10))
    entry_date: Mapped[str] = mapped_column(String(20))
    exit_date: Mapped[str] = mapped_column(String(20))
    entry_price: Mapped[float] = mapped_column(Float)
    exit_price: Mapped[float] = mapped_column(Float)
    quantity: Mapped[float] = mapped_column(Float)
    pnl: Mapped[float] = mapped_column(Float)
    pnl_percent: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(String(120))

    run: Mapped["BacktestRun"] = relationship("BacktestRun", back_populates="trades")


class EquityPoint(Base):
    __tablename__ = "equity_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("backtest_runs.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[str] = mapped_column(String(20))
    value: Mapped[float] = mapped_column(Float)

    run: Mapped["BacktestRun"] = relationship("BacktestRun", back_populates="equity_points")
