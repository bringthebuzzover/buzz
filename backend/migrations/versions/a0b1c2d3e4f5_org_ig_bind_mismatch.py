"""Claimed Instagram handle + bind-mismatch admin flag.

Revision ID: a0b1c2d3e4f5
Revises: f9a0b1c2d3e4
Create Date: 2026-09-17 17:00:00.000000

Apply-time claimed @ is frozen on organizations. Graph overwrites
users.instagram_username at Connect. A first-bind string mismatch is an
admin notice (mismatched_at), not a bind refusal.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a0b1c2d3e4f5"
down_revision: Union[str, Sequence[str], None] = "f9a0b1c2d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("claimed_instagram_username", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("ig_bind_mismatched_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("ig_bind_graph_username", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("ig_bind_mismatch_acked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_organizations_ig_bind_mismatch_open",
        "organizations",
        ["ig_bind_mismatched_at"],
        unique=False,
        postgresql_where=sa.text(
            "ig_bind_mismatched_at IS NOT NULL AND ig_bind_mismatch_acked_at IS NULL"
        ),
    )
    op.execute(sa.text("""
            UPDATE organizations AS o
            SET claimed_instagram_username = ltrim(btrim(u.instagram_username), '@')
            FROM users AS u
            WHERE o.user_id = u.id
              AND u.instagram_username IS NOT NULL
              AND btrim(u.instagram_username) <> ''
            """))


def downgrade() -> None:
    op.drop_index("ix_organizations_ig_bind_mismatch_open", table_name="organizations")
    op.drop_column("organizations", "ig_bind_mismatch_acked_at")
    op.drop_column("organizations", "ig_bind_graph_username")
    op.drop_column("organizations", "ig_bind_mismatched_at")
    op.drop_column("organizations", "claimed_instagram_username")
