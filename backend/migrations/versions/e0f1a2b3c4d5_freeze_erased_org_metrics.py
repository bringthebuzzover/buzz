"""Freeze metrics for orgs already erased, and add the admin audit log.

Revision ID: e0f1a2b3c4d5
Revises: c4d5e6f7a8b9
Create Date: 2026-10-28 14:00:00.000000

Does not delete applications, links, shipments, or posts. Strips Instagram
identifiers on posts owned by erased orgs, stamps metrics_frozen_at, clears
follower_count and university, nulls pitches, and deletes leftover suggestion
and notify-me rows. Idempotent. Downgrade drops the new column and the audit
table; it cannot restore stripped permalinks or captions.

Do not run this by hand against production. Deploy applies it.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e0f1a2b3c4d5"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "social_posts",
        sa.Column("metrics_frozen_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "admin_audit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("drop_id", sa.Uuid(), nullable=True),
        sa.Column("org_id", sa.Uuid(), nullable=True),
        sa.Column("application_id", sa.Uuid(), nullable=True),
        sa.Column("detail", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_admin_audit_events_actor_user_id",
        "admin_audit_events",
        ["actor_user_id"],
    )

    from app.services.erased_org_participation import freeze_statements

    for statement in freeze_statements():
        op.execute(sa.text(statement))


def downgrade() -> None:
    op.drop_index("ix_admin_audit_events_actor_user_id", table_name="admin_audit_events")
    op.drop_table("admin_audit_events")
    op.drop_column("social_posts", "metrics_frozen_at")
