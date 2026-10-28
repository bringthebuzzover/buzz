"""Freeze metrics for orgs already erased, and add the admin audit log.

Revision ID: e0f1a2b3c4d5
Revises: c4d5e6f7a8b9
Create Date: 2026-10-28 14:00:00.000000

Does not delete applications, links, shipments, or posts. Strips Instagram
identifiers on posts owned by erased orgs, stamps metrics_frozen_at, nulls
profile-adjacent insight columns, clears follower_count, university, and
approved_at, nulls application and apply-intent pitches, expires open
intents, and deletes leftover suggestion, notify-me, connect-token, Instagram
change-request, apply-prefill, and one-shot token rows. Idempotent: schema
steps no-op when the column or audit table is already present, and the data
statements can run twice. Downgrade drops the new column and the audit table
only. It cannot restore stripped permalinks, captions, or nulled counts.

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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("social_posts")}
    if "metrics_frozen_at" not in columns:
        op.add_column(
            "social_posts",
            sa.Column("metrics_frozen_at", sa.DateTime(timezone=True), nullable=True),
        )
    if not inspector.has_table("admin_audit_events"):
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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("admin_audit_events"):
        indexes = {index["name"] for index in inspector.get_indexes("admin_audit_events")}
        if "ix_admin_audit_events_actor_user_id" in indexes:
            op.drop_index("ix_admin_audit_events_actor_user_id", table_name="admin_audit_events")
        op.drop_table("admin_audit_events")
    columns = {column["name"] for column in inspector.get_columns("social_posts")}
    if "metrics_frozen_at" in columns:
        op.drop_column("social_posts", "metrics_frozen_at")
