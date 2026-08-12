"""add compliance operations and incident register

Revision ID: 0014_compliance_operations
Revises: 0013_regulatory_audit_trail
"""
from alembic import op
import sqlalchemy as sa

revision = "0014_compliance_operations"
down_revision = "0013_regulatory_audit_trail"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "operation_logs",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column("service", sa.String(length=40), nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("correlation_id", sa.String(length=180), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("bot_id", sa.Integer(), nullable=True),
        sa.Column("method", sa.String(length=10), nullable=True),
        sa.Column("path", sa.String(length=300), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("duration_ms", sa.Float(), nullable=True),
        sa.Column("exchange", sa.String(length=40), nullable=True),
        sa.Column("error_type", sa.String(length=80), nullable=True),
        sa.Column("message", sa.String(length=1000), nullable=False),
        sa.Column("retention_until", sa.DateTime(timezone=True), nullable=False),
    )
    for name in ("occurred_at", "level", "service", "request_id", "correlation_id", "user_id", "bot_id", "path", "status_code", "exchange", "error_type", "retention_until"):
        op.create_index(f"ix_operation_logs_{name}", "operation_logs", [name], unique=False)

    op.create_table(
        "incidents",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retention_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("bot_id", sa.Integer(), nullable=True),
        sa.Column("source_event_id", sa.Integer(), nullable=True),
        sa.Column("correlation_id", sa.String(length=180), nullable=True),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("incident_type", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("action_taken", sa.String(length=255), nullable=True),
        sa.Column("resolution", sa.Text(), nullable=True),
    )
    for name in ("opened_at", "resolved_at", "retention_until", "user_id", "bot_id", "source_event_id", "correlation_id", "severity", "incident_type", "status"):
        op.create_index(f"ix_incidents_{name}", "incidents", [name], unique=False)


def downgrade() -> None:
    op.drop_table("incidents")
    op.drop_table("operation_logs")
