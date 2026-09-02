"""Add org_apply_prefills (apply draft tokens, not accounts).

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-01 18:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "org_apply_prefills",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("invite_email", sa.String(length=320), nullable=False),
        sa.Column("org_name", sa.String(length=255), nullable=True),
        sa.Column("university", sa.String(length=255), nullable=True),
        sa.Column("edu_email", sa.String(length=320), nullable=True),
        sa.Column("instagram_handle", sa.String(length=255), nullable=True),
        sa.Column("member_count", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(length=32), nullable=True),
        sa.Column("contact_name", sa.String(length=255), nullable=True),
        sa.Column("shipping_line1", sa.String(length=255), nullable=True),
        sa.Column("shipping_line2", sa.String(length=255), nullable=True),
        sa.Column("shipping_city", sa.String(length=255), nullable=True),
        sa.Column("shipping_postal_code", sa.String(length=10), nullable=True),
        sa.Column("shipping_state", sa.String(length=2), nullable=True),
        sa.Column("shipping_raw", sa.Text(), nullable=True),
        sa.Column("extras", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("source", sa.String(length=64), nullable=True),
        sa.Column("source_row_key", sa.String(length=320), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_by_user_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["used_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        "ix_org_apply_prefills_source_row_key",
        "org_apply_prefills",
        ["source_row_key"],
    )


def downgrade() -> None:
    op.drop_index("ix_org_apply_prefills_source_row_key", table_name="org_apply_prefills")
    op.drop_table("org_apply_prefills")
