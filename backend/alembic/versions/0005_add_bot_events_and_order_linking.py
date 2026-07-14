"""Add bot events and order linking fields.

Revision ID: 0005_bot_events_order_links
Revises: 0004_add_bot_runtime_and_orders
Create Date: 2026-07-06 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0005_bot_events_order_links"
down_revision: Union[str, None] = "0004_add_bot_runtime_and_orders"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("trading_bot_orders") as batch_op:
        batch_op.add_column(
            sa.Column("order_link_id", sa.String(length=160), nullable=True))
        batch_op.add_column(
            sa.Column("filled_qty", sa.Float(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("parent_order_id",
                            sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_trading_bot_orders_parent_order_id",
            "trading_bot_orders",
            ["parent_order_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.create_index("ix_trading_bot_orders_order_link_id",
                    "trading_bot_orders", ["order_link_id"])

    op.create_table(
        "trading_bot_events",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("bot_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(
            ["bot_id"], ["trading_bots.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_trading_bot_events_bot_id",
                    "trading_bot_events", ["bot_id"])
    op.create_index("ix_trading_bot_events_user_id",
                    "trading_bot_events", ["user_id"])
    op.create_index("ix_trading_bot_events_created_at",
                    "trading_bot_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_trading_bot_events_created_at",
                  table_name="trading_bot_events")
    op.drop_index("ix_trading_bot_events_user_id",
                  table_name="trading_bot_events")
    op.drop_index("ix_trading_bot_events_bot_id",
                  table_name="trading_bot_events")
    op.drop_table("trading_bot_events")

    op.drop_index("ix_trading_bot_orders_order_link_id",
                  table_name="trading_bot_orders")
    with op.batch_alter_table("trading_bot_orders") as batch_op:
        batch_op.drop_constraint(
            "fk_trading_bot_orders_parent_order_id", type_="foreignkey")
        batch_op.drop_column("parent_order_id")
        batch_op.drop_column("filled_qty")
        batch_op.drop_column("order_link_id")
