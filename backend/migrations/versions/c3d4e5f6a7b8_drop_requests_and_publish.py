"""Add drop_requests + drops.published_at + drops.drop_request_id.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-26 14:00:00.000000

LAUNCH.md Phase B: brand intake ticket ≠ live drop; Publish sets published_at.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "drop_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("brand_id", sa.Uuid(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="received", nullable=False),
        sa.Column("converted_drop_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_drop_requests_brand_id", "drop_requests", ["brand_id"])

    op.add_column(
        "drops",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "drops",
        sa.Column("drop_request_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_drops_drop_request_id",
        "drops",
        "drop_requests",
        ["drop_request_id"],
        ["id"],
    )
    op.create_index("ix_drops_published_at", "drops", ["published_at"])

    # Soft pointer ticket → drop (circular; added after drops.drop_request_id).
    op.create_foreign_key(
        "fk_drop_requests_converted_drop_id",
        "drop_requests",
        "drops",
        ["converted_drop_id"],
        ["id"],
    )

    # Existing non-stub drops become published so seed/E2E keep working.
    op.execute(
        """
        UPDATE drops
        SET published_at = created_at
        WHERE brand_tracker_stage <> 'request_received'
          AND published_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_drop_requests_converted_drop_id", "drop_requests", type_="foreignkey")
    op.drop_index("ix_drops_published_at", table_name="drops")
    op.drop_constraint("fk_drops_drop_request_id", "drops", type_="foreignkey")
    op.drop_column("drops", "drop_request_id")
    op.drop_column("drops", "published_at")
    op.drop_index("ix_drop_requests_brand_id", table_name="drop_requests")
    op.drop_table("drop_requests")
