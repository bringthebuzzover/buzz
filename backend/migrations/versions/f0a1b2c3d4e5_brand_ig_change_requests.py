"""Brand Instagram handle change requests

Revision ID: f0a1b2c3d4e5
Revises: f2a3b4c5d6e7
Create Date: 2026-10-29 00:30:00.000000

Tickets for PRODUCT §3.1.5. Approve writes ``brands.instagram_handle``.
This table is the request and the audit row. One pending request per brand.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f0a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "brand_ig_change_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("brand_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("current_handle", sa.String(length=255), nullable=False),
        sa.Column("requested_handle", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_brand_ig_change_requests_brand_id",
        "brand_ig_change_requests",
        ["brand_id"],
    )
    op.create_index(
        "uq_brand_ig_change_requests_one_pending",
        "brand_ig_change_requests",
        ["brand_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_brand_ig_change_requests_one_pending", table_name="brand_ig_change_requests"
    )
    op.drop_index("ix_brand_ig_change_requests_brand_id", table_name="brand_ig_change_requests")
    op.drop_table("brand_ig_change_requests")
