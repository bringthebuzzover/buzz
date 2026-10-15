"""Creator portal role, per-portal email uniqueness, creators table.

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-10-15 18:10:00.000000

Creator lifecycle lives on ``creators.status``. ``users.edu_email`` and
``users.pending_edu_email`` are unique per portal so an org contact and a
creator may share a campus address.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

creator_status = postgresql.ENUM(
    "pending_email",
    "pending_review",
    "pending_instagram",
    "active",
    "denied",
    name="creator_status",
    create_type=False,
)


def upgrade() -> None:
    op.execute("ALTER TYPE portal_role ADD VALUE IF NOT EXISTS 'creator'")
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE creator_status AS ENUM ("
        "'pending_email', 'pending_review', 'pending_instagram', 'active', 'denied'"
        "); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$;"
    )
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_edu_email_key")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_pending_edu_email")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_edu_email_per_portal "
        "ON users (portal_role, lower(edu_email)) "
        "WHERE edu_email IS NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_pending_edu_email_per_portal "
        "ON users (portal_role, lower(pending_edu_email)) "
        "WHERE pending_edu_email IS NOT NULL"
    )
    op.create_table(
        "creators",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("school", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=255), nullable=False),
        sa.Column("grad_year", sa.String(length=16), nullable=False),
        sa.Column("niches", postgresql.ARRAY(sa.String(length=64)), nullable=False),
        sa.Column("bio", sa.Text(), nullable=False),
        sa.Column("claimed_instagram_username", sa.String(length=255), nullable=False),
        sa.Column("tiktok_handle", sa.String(length=255), server_default="", nullable=False),
        sa.Column("open_to", postgresql.ARRAY(sa.String(length=64)), nullable=False),
        sa.Column("status", creator_status, nullable=False),
        sa.Column("follower_count", sa.Integer(), nullable=True),
        sa.Column("post_count", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("creators")
    op.execute("DROP INDEX IF EXISTS uq_users_edu_email_per_portal")
    op.execute("DROP INDEX IF EXISTS uq_users_pending_edu_email_per_portal")
    op.create_unique_constraint("users_edu_email_key", "users", ["edu_email"])
    op.create_unique_constraint("uq_users_pending_edu_email", "users", ["pending_edu_email"])
