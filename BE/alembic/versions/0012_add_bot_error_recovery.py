"""add bot error classification and recovery state

Revision ID: 0012
Revises: 0011
"""
from alembic import op
import sqlalchemy as sa

revision = "0012_bot_error_recovery"
down_revision = "0011_telegram_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trading_bots", sa.Column("last_error_type", sa.String(length=40), nullable=True))
    op.add_column("trading_bots", sa.Column("last_error_severity", sa.String(length=20), nullable=True))
    op.add_column("trading_bots", sa.Column("last_error_action", sa.String(length=40), nullable=True))
    op.add_column("trading_bots", sa.Column("last_error_code", sa.String(length=40), nullable=True))
    op.add_column("trading_bots", sa.Column("last_error_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("trading_bots", sa.Column("error_retry_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("trading_bots", sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("trading_bots", "next_retry_at")
    op.drop_column("trading_bots", "error_retry_count")
    op.drop_column("trading_bots", "last_error_at")
    op.drop_column("trading_bots", "last_error_code")
    op.drop_column("trading_bots", "last_error_action")
    op.drop_column("trading_bots", "last_error_severity")
    op.drop_column("trading_bots", "last_error_type")
