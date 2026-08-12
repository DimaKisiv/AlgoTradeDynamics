"""add immutable regulatory audit trail

Revision ID: 0013_regulatory_audit_trail
Revises: 0012_bot_error_recovery
"""
from alembic import op
import sqlalchemy as sa

revision = "0013_regulatory_audit_trail"
down_revision = "0012_bot_error_recovery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("bot_id", sa.Integer(), nullable=True),
        sa.Column("source_event_id", sa.Integer(), nullable=True),
        sa.Column("actor_type", sa.String(length=20), nullable=False),
        sa.Column("actor_label", sa.String(length=255), nullable=True),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column("exchange", sa.String(length=40), nullable=True),
        sa.Column("environment", sa.String(length=20), nullable=True),
        sa.Column("symbol", sa.String(length=30), nullable=True),
        sa.Column("order_link_id", sa.String(length=160), nullable=True),
        sa.Column("exchange_order_id", sa.String(length=120), nullable=True),
        sa.Column("side", sa.String(length=10), nullable=True),
        sa.Column("order_type", sa.String(length=20), nullable=True),
        sa.Column("order_role", sa.String(length=50), nullable=True),
        sa.Column("quantity", sa.Float(), nullable=True),
        sa.Column("filled_quantity", sa.Float(), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("fee", sa.Float(), nullable=True),
        sa.Column("realized_pnl", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=True),
        sa.Column("correlation_id", sa.String(length=180), nullable=True),
        sa.Column("strategy_type", sa.String(length=40), nullable=True),
        sa.Column("strategy_version", sa.String(length=40), nullable=True),
        sa.Column("config_hash", sa.String(length=64), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("error_code", sa.String(length=40), nullable=True),
        sa.Column("error_type", sa.String(length=40), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("jurisdiction", sa.String(length=40), nullable=False),
        sa.Column("retention_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("previous_hash", sa.String(length=64), nullable=True),
        sa.Column("event_hash", sa.String(length=64), nullable=False),
        sa.UniqueConstraint("event_hash", name="uq_audit_events_event_hash"),
    )
    for name in (
        "occurred_at", "recorded_at", "user_id", "bot_id", "source_event_id", "actor_type", "category",
        "event_type", "exchange", "symbol", "order_link_id", "exchange_order_id", "status", "correlation_id",
        "config_hash", "retention_until", "event_hash",
    ):
        op.create_index(f"ix_audit_events_{name}", "audit_events", [name], unique=False)

    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.execute("""
            CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
            RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'audit_events is append-only; UPDATE/DELETE is forbidden';
            END;
            $$ LANGUAGE plpgsql;
        """)
        op.execute("""
            CREATE TRIGGER audit_events_append_only
            BEFORE UPDATE OR DELETE ON audit_events
            FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
        """)
    elif dialect == "sqlite":
        op.execute("""
            CREATE TRIGGER audit_events_no_update
            BEFORE UPDATE ON audit_events
            BEGIN
                SELECT RAISE(ABORT, 'audit_events is append-only');
            END;
        """)
        op.execute("""
            CREATE TRIGGER audit_events_no_delete
            BEFORE DELETE ON audit_events
            BEGIN
                SELECT RAISE(ABORT, 'audit_events is append-only');
            END;
        """)


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events")
        op.execute("DROP FUNCTION IF EXISTS prevent_audit_event_mutation()")
    elif dialect == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS audit_events_no_update")
        op.execute("DROP TRIGGER IF EXISTS audit_events_no_delete")
    op.drop_table("audit_events")
