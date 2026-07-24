"""Add fill-event and cycle-completion tracking to trading bot orders.

Revision ID: 0006_order_fill_cycle_flags
Revises: 0005_bot_events_order_links
Create Date: 2026-07-06 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0006_order_fill_cycle_flags"
down_revision: Union[str, None] = "0005_bot_events_order_links"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("trading_bot_orders") as batch_op:
        batch_op.add_column(
            sa.Column("filled_event_logged_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("cycle_completed_at",
                            sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("trading_bot_orders") as batch_op:
        batch_op.drop_column("cycle_completed_at")
        batch_op.drop_column("filled_event_logged_at")
