"""Replace legacy MA/RSI backtests with emulator-driven bot backtests.

Revision ID: 0008_replace_legacy_backtests
Revises: 0007_add_order_link_generation
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008_replace_legacy_backtests"
down_revision: Union[str, None] = "0007_add_order_link_generation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Legacy results are intentionally removed: they belong to the old MA/RSI engine
    # and are not comparable with emulator-driven bot runs.
    op.drop_table("equity_points")
    op.drop_table("trades")
    op.drop_index("ix_backtest_runs_user_id", table_name="backtest_runs")
    op.drop_index("ix_backtest_runs_created_at", table_name="backtest_runs")
    op.drop_table("backtest_runs")

    op.create_table(
        "backtest_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_bot_id", sa.Integer(), sa.ForeignKey("trading_bots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("temp_bot_id", sa.Integer(), nullable=True),
        sa.Column("emulator_account_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("bot_name", sa.String(120), nullable=False),
        sa.Column("symbol", sa.String(30), nullable=False),
        sa.Column("interval", sa.String(10), nullable=False, server_default="1"),
        sa.Column("start_time", sa.BigInteger(), nullable=False),
        sa.Column("end_time", sa.BigInteger(), nullable=False),
        sa.Column("initial_balance", sa.Float(), nullable=False),
        sa.Column("fee_rate", sa.Float(), nullable=False, server_default="0.0002"),
        sa.Column("slippage_percent", sa.Float(), nullable=False, server_default="0"),
        sa.Column("path_mode", sa.String(30), nullable=False, server_default="conservative"),
        sa.Column("end_behavior", sa.String(30), nullable=False, server_default="keep_open"),
        sa.Column("status", sa.String(30), nullable=False, server_default="queued"),
        sa.Column("progress", sa.Float(), nullable=False, server_default="0"),
        sa.Column("processed_candles", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_candles", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("current_time", sa.BigInteger(), nullable=True),
        sa.Column("current_price", sa.Float(), nullable=True),
        sa.Column("pause_requested", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("bot_snapshot", sa.JSON(), nullable=False),
        sa.Column("configuration", sa.JSON(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_backtest_runs_user_id", "backtest_runs", ["user_id"])
    op.create_index("ix_backtest_runs_source_bot_id", "backtest_runs", ["source_bot_id"])
    op.create_index("ix_backtest_runs_status", "backtest_runs", ["status"])
    op.create_index("ix_backtest_runs_symbol", "backtest_runs", ["symbol"])
    op.create_index("ix_backtest_runs_created_at", "backtest_runs", ["created_at"])

    op.create_table(
        "backtest_points",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("backtest_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("timestamp", sa.BigInteger(), nullable=False),
        sa.Column("open", sa.Float(), nullable=False),
        sa.Column("high", sa.Float(), nullable=False),
        sa.Column("low", sa.Float(), nullable=False),
        sa.Column("close", sa.Float(), nullable=False),
        sa.Column("balance", sa.Float(), nullable=False),
        sa.Column("equity", sa.Float(), nullable=False),
        sa.Column("available_balance", sa.Float(), nullable=False),
        sa.Column("unrealized_pnl", sa.Float(), nullable=False),
        sa.Column("position_qty", sa.Float(), nullable=False),
        sa.Column("position_value", sa.Float(), nullable=False),
        sa.Column("drawdown_percent", sa.Float(), nullable=False),
    )
    op.create_index("ix_backtest_points_run_id", "backtest_points", ["run_id"])
    op.create_index("ix_backtest_points_timestamp", "backtest_points", ["timestamp"])

    op.create_table(
        "backtest_cycles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("backtest_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cycle_number", sa.Integer(), nullable=False),
        sa.Column("started_at_ms", sa.BigInteger(), nullable=False),
        sa.Column("closed_at_ms", sa.BigInteger(), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=False, server_default="0"),
        sa.Column("time_in_loss_seconds", sa.Float(), nullable=False, server_default="0"),
        sa.Column("max_unrealized_loss", sa.Float(), nullable=False, server_default="0"),
        sa.Column("max_position_qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("max_position_value", sa.Float(), nullable=False, server_default="0"),
        sa.Column("entries_filled", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_entry_price", sa.Float(), nullable=True),
        sa.Column("exit_price", sa.Float(), nullable=True),
        sa.Column("gross_pnl", sa.Float(), nullable=False, server_default="0"),
        sa.Column("fees", sa.Float(), nullable=False, server_default="0"),
        sa.Column("net_pnl", sa.Float(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("details", sa.JSON(), nullable=False),
    )
    op.create_index("ix_backtest_cycles_run_id", "backtest_cycles", ["run_id"])

    # batch_alter_table keeps the migration usable with both PostgreSQL (Docker)
    # and SQLite development databases.
    with op.batch_alter_table("trading_bots") as batch_op:
        batch_op.add_column(sa.Column("is_backtest", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column("backtest_run_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_trading_bots_is_backtest", ["is_backtest"])
        batch_op.create_index("ix_trading_bots_backtest_run_id", ["backtest_run_id"])
        batch_op.create_foreign_key(
            "fk_trading_bots_backtest_run_id",
            "backtest_runs",
            ["backtest_run_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    raise RuntimeError("Downgrade to the removed legacy MA/RSI schema is intentionally unsupported")
