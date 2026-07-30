"""ORM models for emulator-driven trading bot backtests."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_bot_id: Mapped[int | None] = mapped_column(
        ForeignKey("trading_bots.id", ondelete="SET NULL"), index=True, nullable=True
    )
    temp_bot_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    emulator_account_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    name: Mapped[str] = mapped_column(String(180), nullable=False)
    bot_name: Mapped[str] = mapped_column(String(120), nullable=False)
    symbol: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    interval: Mapped[str] = mapped_column(String(10), nullable=False, default="1")
    start_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    end_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    initial_balance: Mapped[float] = mapped_column(Float, nullable=False, default=10_000)
    fee_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0002)
    slippage_percent: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    path_mode: Mapped[str] = mapped_column(String(30), nullable=False, default="conservative")
    end_behavior: Mapped[str] = mapped_column(String(30), nullable=False, default="keep_open")

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="queued", index=True)
    progress: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    processed_candles: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_candles: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    current_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    pause_requested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    bot_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    configuration: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="runs")
    points: Mapped[list["BacktestPoint"]] = relationship(
        "BacktestPoint", back_populates="run", cascade="all, delete-orphan"
    )
    cycles: Mapped[list["BacktestCycle"]] = relationship(
        "BacktestCycle", back_populates="run", cascade="all, delete-orphan"
    )


class BacktestPoint(Base):
    __tablename__ = "backtest_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("backtest_runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    timestamp: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    open: Mapped[float] = mapped_column(Float, nullable=False)
    high: Mapped[float] = mapped_column(Float, nullable=False)
    low: Mapped[float] = mapped_column(Float, nullable=False)
    close: Mapped[float] = mapped_column(Float, nullable=False)
    balance: Mapped[float] = mapped_column(Float, nullable=False)
    equity: Mapped[float] = mapped_column(Float, nullable=False)
    available_balance: Mapped[float] = mapped_column(Float, nullable=False)
    unrealized_pnl: Mapped[float] = mapped_column(Float, nullable=False)
    position_qty: Mapped[float] = mapped_column(Float, nullable=False)
    position_value: Mapped[float] = mapped_column(Float, nullable=False)
    drawdown_percent: Mapped[float] = mapped_column(Float, nullable=False)

    run: Mapped["BacktestRun"] = relationship("BacktestRun", back_populates="points")


class BacktestCycle(Base):
    __tablename__ = "backtest_cycles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("backtest_runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cycle_number: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at_ms: Mapped[int] = mapped_column(BigInteger, nullable=False)
    closed_at_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    time_in_loss_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    max_unrealized_loss: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    max_position_qty: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    max_position_value: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    entries_filled: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_entry_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    exit_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    gross_pnl: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    fees: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    net_pnl: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    details: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    run: Mapped["BacktestRun"] = relationship("BacktestRun", back_populates="cycles")
