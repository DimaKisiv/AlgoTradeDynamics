"""Add trading_bots table.

Revision ID: 0003_add_trading_bots
Revises: 0002_add_users_and_user_id
Create Date: 2026-07-06 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0003_add_trading_bots"
down_revision: Union[str, None] = "0002_add_users_and_user_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trading_bots",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("exchange", sa.String(length=40),
                  nullable=False, server_default="bybit"),
        sa.Column("environment", sa.String(length=20),
                  nullable=False, server_default="demo"),
        sa.Column("strategy_type", sa.String(length=40),
                  nullable=False, server_default="grid"),
        sa.Column("category", sa.String(length=20),
                  nullable=False, server_default="linear"),
        sa.Column("symbol", sa.String(length=30),
                  nullable=False, server_default="BTCUSDT"),
        sa.Column("order_qty", sa.Float(),
                  nullable=False, server_default="0.001"),
        sa.Column("grid_orders_count", sa.Integer(),
                  nullable=False, server_default="2"),
        sa.Column("grid_step_percent", sa.Float(),
                  nullable=False, server_default="5"),
        sa.Column("is_active", sa.Boolean(),
                  nullable=False, server_default=sa.true()),
        sa.Column("settings", sa.JSON(), nullable=False,
                  server_default=sa.text("'{}'")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_trading_bots_user_id", "trading_bots", ["user_id"])
    op.create_index("ix_trading_bots_created_at",
                    "trading_bots", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_trading_bots_created_at", table_name="trading_bots")
    op.drop_index("ix_trading_bots_user_id", table_name="trading_bots")
    op.drop_table("trading_bots")
