"""Add users table, link backtest_runs to a user, seed a demo user.

Revision ID: 0002_add_users_and_user_id
Revises: 0001_initial
Create Date: 2026-01-15 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

from app.core.security import hash_password

revision: str = "0002_add_users_and_user_id"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEMO_EMAIL = "demo@algotrade.dev"
DEMO_PASSWORD = "demo1234"


def upgrade() -> None:
    # 1. Create the users table.
    #    index=True already creates ix_users_id automatically, so an explicit
    #    op.create_index call for the ID column would create a duplicate index.
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    conn = op.get_bind()

    # 2. Seed the demo user so the application is usable immediately after migration.
    conn.execute(
        sa.text("INSERT INTO users (email, hashed_password) VALUES (:email, :pw)"),
        {"email": DEMO_EMAIL, "pw": hash_password(DEMO_PASSWORD)},
    )
    demo_id = conn.execute(
        sa.text("SELECT id FROM users WHERE email = :email"), {"email": DEMO_EMAIL}
    ).scalar_one()

    # 3. Add user_id as nullable first so existing records can be backfilled.
    op.add_column("backtest_runs", sa.Column("user_id", sa.Integer(), nullable=True))
    conn.execute(
        sa.text("UPDATE backtest_runs SET user_id = :uid WHERE user_id IS NULL"),
        {"uid": demo_id},
    )

    # 4. Apply NOT NULL and FK constraints. batch_alter_table uses regular ALTER
    #    on PostgreSQL and recreates the table correctly on SQLite.
    with op.batch_alter_table("backtest_runs") as batch_op:
        batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
        batch_op.create_foreign_key(
            "fk_backtest_runs_user_id",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )

    op.create_index("ix_backtest_runs_user_id", "backtest_runs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_backtest_runs_user_id", table_name="backtest_runs")
    with op.batch_alter_table("backtest_runs") as batch_op:
        batch_op.drop_constraint("fk_backtest_runs_user_id", type_="foreignkey")
        batch_op.drop_column("user_id")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
