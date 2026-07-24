"""Add runtime fields and trading bot orders table.

Revision ID: 0004_add_bot_runtime_and_orders
Revises: 0003_add_trading_bots
Create Date: 2026-07-06 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0004_add_bot_runtime_and_orders"
down_revision: Union[str, None] = "0003_add_trading_bots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("trading_bots") as batch_op:
        batch_op.add_column(sa.Column("runtime_status", sa.String(
            length=20), nullable=False, server_default="stopped"))
        batch_op.add_column(
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(
            sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(
            sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(
            sa.Column("last_error", sa.String(length=500), nullable=True))

    op.create_table(
        "trading_bot_orders",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("bot_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("exchange", sa.String(length=40), nullable=False),
        sa.Column("environment", sa.String(length=20), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("symbol", sa.String(length=30), nullable=False),
        sa.Column("side", sa.String(length=10), nullable=False),
        sa.Column("order_type", sa.String(length=20), nullable=False),
        sa.Column("order_role", sa.String(length=50), nullable=False),
        sa.Column("qty", sa.Float(), nullable=False),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("exchange_order_id", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=30),
                  nullable=False, server_default="New"),
        sa.Column("raw_response", sa.JSON(), nullable=False,
                  server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(
            ["bot_id"], ["trading_bots.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_trading_bot_orders_bot_id",
                    "trading_bot_orders", ["bot_id"])
    op.create_index("ix_trading_bot_orders_user_id",
                    "trading_bot_orders", ["user_id"])
    op.create_index("ix_trading_bot_orders_created_at",
                    "trading_bot_orders", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_trading_bot_orders_created_at",
                  table_name="trading_bot_orders")
    op.drop_index("ix_trading_bot_orders_user_id",
                  table_name="trading_bot_orders")
    op.drop_index("ix_trading_bot_orders_bot_id",
                  table_name="trading_bot_orders")
    op.drop_table("trading_bot_orders")

    with op.batch_alter_table("trading_bots") as batch_op:
        batch_op.drop_column("last_error")
        batch_op.drop_column("last_run_at")
        batch_op.drop_column("stopped_at")
        batch_op.drop_column("started_at")
        batch_op.drop_column("runtime_status")
