"""Add order link generation to trading bots.

Revision ID: 0007_add_order_link_generation
Revises: 0006_order_fill_cycle_flags
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0007_add_order_link_generation"
down_revision: Union[str, None] = "0006_order_fill_cycle_flags"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("trading_bots") as batch_op:
        batch_op.add_column(
            sa.Column("order_link_generation", sa.Integer(),
                      nullable=False, server_default="1")
        )

    op.execute(
        "UPDATE trading_bots SET order_link_generation = 1 WHERE order_link_generation IS NULL")

    with op.batch_alter_table("trading_bots") as batch_op:
        batch_op.alter_column("order_link_generation", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("trading_bots") as batch_op:
        batch_op.drop_column("order_link_generation")
