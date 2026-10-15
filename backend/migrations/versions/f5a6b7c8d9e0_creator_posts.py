"""Creator-owned social posts and application content/payout state.

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d0
Create Date: 2026-10-15 19:20:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, Sequence[str], None] = "e4f5a6b7c8d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE post_link_source ADD VALUE IF NOT EXISTS 'creator_manual'")
    op.add_column("social_posts", sa.Column("creator_id", sa.Uuid(), nullable=True))
    op.alter_column("social_posts", "org_id", existing_type=sa.Uuid(), nullable=True)
    op.create_foreign_key(
        "fk_social_posts_creator_id",
        "social_posts",
        "creators",
        ["creator_id"],
        ["id"],
    )
    op.create_check_constraint(
        "ck_social_posts_one_owner",
        "social_posts",
        "(org_id IS NOT NULL AND creator_id IS NULL) OR "
        "(org_id IS NULL AND creator_id IS NOT NULL)",
    )
    op.execute(
        "ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS "
        "uq_social_posts_org_platform_external_id"
    )
    op.create_index(
        "uq_social_posts_org_platform_external_id",
        "social_posts",
        ["org_id", "platform", "external_id"],
        unique=True,
        postgresql_where=sa.text("org_id IS NOT NULL"),
    )
    op.create_index(
        "uq_social_posts_creator_platform_external_id",
        "social_posts",
        ["creator_id", "platform", "external_id"],
        unique=True,
        postgresql_where=sa.text("creator_id IS NOT NULL"),
    )
    op.add_column(
        "drop_applications",
        sa.Column("content_state", sa.String(length=32), server_default="none", nullable=False),
    )
    op.add_column(
        "drop_applications",
        sa.Column(
            "payout_state",
            sa.String(length=32),
            server_default="not_recorded",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("drop_applications", "payout_state")
    op.drop_column("drop_applications", "content_state")
    op.drop_index("uq_social_posts_creator_platform_external_id", table_name="social_posts")
    op.execute("DROP INDEX IF EXISTS uq_social_posts_org_platform_external_id")
    op.create_unique_constraint(
        "uq_social_posts_org_platform_external_id",
        "social_posts",
        ["org_id", "platform", "external_id"],
    )
    op.drop_constraint("ck_social_posts_one_owner", "social_posts", type_="check")
    op.drop_constraint("fk_social_posts_creator_id", "social_posts", type_="foreignkey")
    op.drop_column("social_posts", "creator_id")
    op.alter_column("social_posts", "org_id", existing_type=sa.Uuid(), nullable=False)
