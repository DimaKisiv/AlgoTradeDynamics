"""Add per-user Telegram notification channels and delivery outbox.

Revision ID: 0011_telegram_notifications
Revises: 0010_add_refresh_tokens
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0011_telegram_notifications"
down_revision: Union[str, None] = "0010_add_refresh_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "telegram_notification_channels",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("chat_id", sa.BigInteger(), nullable=False),
        sa.Column("telegram_user_id", sa.BigInteger(), nullable=True),
        sa.Column("username", sa.String(length=255), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notify_trades", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notify_bot_status", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notify_errors", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notify_risk", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chat_id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_telegram_notification_channels_user_id", "telegram_notification_channels", ["user_id"], unique=False)
    op.create_index("ix_telegram_notification_channels_chat_id", "telegram_notification_channels", ["chat_id"], unique=False)

    op.create_table(
        "telegram_link_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_telegram_link_tokens_user_id", "telegram_link_tokens", ["user_id"], unique=False)
    op.create_index("ix_telegram_link_tokens_token_hash", "telegram_link_tokens", ["token_hash"], unique=False)
    op.create_index("ix_telegram_link_tokens_expires_at", "telegram_link_tokens", ["expires_at"], unique=False)

    op.create_table(
        "telegram_notification_deliveries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["event_id"], ["trading_bot_events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id"),
    )
    op.create_index("ix_telegram_notification_deliveries_event_id", "telegram_notification_deliveries", ["event_id"], unique=False)
    op.create_index("ix_telegram_notification_deliveries_user_id", "telegram_notification_deliveries", ["user_id"], unique=False)
    op.create_index("ix_telegram_notification_deliveries_status", "telegram_notification_deliveries", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_telegram_notification_deliveries_status", table_name="telegram_notification_deliveries")
    op.drop_index("ix_telegram_notification_deliveries_user_id", table_name="telegram_notification_deliveries")
    op.drop_index("ix_telegram_notification_deliveries_event_id", table_name="telegram_notification_deliveries")
    op.drop_table("telegram_notification_deliveries")
    op.drop_index("ix_telegram_link_tokens_expires_at", table_name="telegram_link_tokens")
    op.drop_index("ix_telegram_link_tokens_token_hash", table_name="telegram_link_tokens")
    op.drop_index("ix_telegram_link_tokens_user_id", table_name="telegram_link_tokens")
    op.drop_table("telegram_link_tokens")
    op.drop_index("ix_telegram_notification_channels_chat_id", table_name="telegram_notification_channels")
    op.drop_index("ix_telegram_notification_channels_user_id", table_name="telegram_notification_channels")
    op.drop_table("telegram_notification_channels")
