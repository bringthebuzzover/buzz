"""Add instagram_token_user_id; drop unused org_user_status.suspended.

``suspended`` was never written by application code. Any stray rows are moved
to ``denied`` before the enum is rebuilt without that value.

Steps are idempotent so a partially-applied local upgrade (PG DDL can
auto-commit around ``ALTER TYPE``) can finish cleanly.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    has_col = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'users' AND column_name = 'instagram_token_user_id'"
        )
    ).scalar()
    if not has_col:
        op.add_column(
            "users",
            sa.Column("instagram_token_user_id", sa.String(length=255), nullable=True),
        )
        op.create_unique_constraint(None, "users", ["instagram_token_user_id"])

    # Backfill exchange id from Graph id where present (they usually match).
    op.execute(
        sa.text(
            "UPDATE users SET instagram_token_user_id = instagram_user_id "
            "WHERE instagram_user_id IS NOT NULL AND instagram_token_user_id IS NULL"
        )
    )

    has_suspended = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_type t "
            "JOIN pg_enum e ON t.oid = e.enumtypid "
            "WHERE t.typname = 'org_user_status' AND e.enumlabel = 'suspended'"
        )
    ).scalar()
    if has_suspended:
        # Move any legacy suspended rows before rebuilding the enum.
        op.execute(sa.text("UPDATE users SET status = 'denied' WHERE status = 'suspended'"))
        op.execute(sa.text("ALTER TYPE org_user_status RENAME TO org_user_status_old"))
        op.execute(
            sa.text(
                "CREATE TYPE org_user_status AS ENUM ("
                "'pending_org_profile', 'pending_email_verification', "
                "'pending_approval', 'active', 'denied'"
                ")"
            )
        )
        op.execute(
            sa.text(
                "ALTER TABLE users ALTER COLUMN status TYPE org_user_status "
                "USING status::text::org_user_status"
            )
        )
        op.execute(sa.text("DROP TYPE org_user_status_old"))


def downgrade() -> None:
    op.execute(sa.text("ALTER TYPE org_user_status RENAME TO org_user_status_old"))
    op.execute(
        sa.text(
            "CREATE TYPE org_user_status AS ENUM ("
            "'pending_org_profile', 'pending_email_verification', "
            "'pending_approval', 'active', 'denied', 'suspended'"
            ")"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE users ALTER COLUMN status TYPE org_user_status "
            "USING status::text::org_user_status"
        )
    )
    op.execute(sa.text("DROP TYPE org_user_status_old"))

    # Downgrade: drop by column uniqueness (constraint was created unnamed).
    op.drop_constraint("users_instagram_token_user_id_key", "users", type_="unique")
    op.drop_column("users", "instagram_token_user_id")
