"""Attach backtest runs to one immutable emulator dataset.

Revision ID: 0009_backtest_dataset_id
Revises: 0008_replace_legacy_backtests
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009_backtest_dataset_id"
down_revision: Union[str, None] = "0008_replace_legacy_backtests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("backtest_runs") as batch_op:
        batch_op.add_column(sa.Column("dataset_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("dataset_name", sa.String(length=180), nullable=True))
        batch_op.create_index("ix_backtest_runs_dataset_id", ["dataset_id"])


def downgrade() -> None:
    with op.batch_alter_table("backtest_runs") as batch_op:
        batch_op.drop_index("ix_backtest_runs_dataset_id")
        batch_op.drop_column("dataset_name")
        batch_op.drop_column("dataset_id")
