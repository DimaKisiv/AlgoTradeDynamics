"""Initial schema: backtest_runs, trades, equity_points

Revision ID: 0001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "backtest_runs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("symbol", sa.String(30), nullable=False, server_default="BTC/USDT"),
        sa.Column("strategy_name", sa.String(80), nullable=False),
        sa.Column("strategy_params", sa.JSON(), nullable=False),
        sa.Column("risk_params", sa.JSON(), nullable=False),
        sa.Column("initial_balance", sa.Float(), nullable=False),
        sa.Column("final_balance", sa.Float(), nullable=False),
        sa.Column("total_pnl", sa.Float(), nullable=False),
        sa.Column("total_pnl_percent", sa.Float(), nullable=False),
        sa.Column("max_drawdown_percent", sa.Float(), nullable=False),
        sa.Column("win_rate_percent", sa.Float(), nullable=False),
        sa.Column("trades_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="completed"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_backtest_runs_created_at", "backtest_runs", ["created_at"])

    op.create_table(
        "trades",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "run_id",
            sa.Integer(),
            sa.ForeignKey("backtest_runs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("symbol", sa.String(30), nullable=False),
        sa.Column("side", sa.String(10), nullable=False),
        sa.Column("entry_date", sa.String(20), nullable=False),
        sa.Column("exit_date", sa.String(20), nullable=False),
        sa.Column("entry_price", sa.Float(), nullable=False),
        sa.Column("exit_price", sa.Float(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("pnl", sa.Float(), nullable=False),
        sa.Column("pnl_percent", sa.Float(), nullable=False),
        sa.Column("reason", sa.String(120), nullable=False),
    )

    op.create_table(
        "equity_points",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "run_id",
            sa.Integer(),
            sa.ForeignKey("backtest_runs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("date", sa.String(20), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("equity_points")
    op.drop_table("trades")
    op.drop_index("ix_backtest_runs_created_at", table_name="backtest_runs")
    op.drop_table("backtest_runs")
