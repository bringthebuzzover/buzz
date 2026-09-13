"""Per-accepted-seat shipments; backfill from drops.tracking_number.

Revision ID: c5d6e7f8a9b0
Revises: f7a8b9c0d1e2
Create Date: 2026-09-13 15:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, Sequence[str], None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "drop_application_shipments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("tracking_number", sa.String(length=255), nullable=False),
        sa.Column("carrier", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "carrier IN ('ups', 'fedex', 'unknown')",
            name="ck_drop_application_shipments_carrier",
        ),
        sa.ForeignKeyConstraint(
            ["application_id"],
            ["drop_applications.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "application_id",
            "tracking_number",
            name="uq_drop_application_shipments_app_tn",
        ),
    )
    op.create_index(
        "ix_drop_application_shipments_application_id",
        "drop_application_shipments",
        ["application_id"],
    )
    # Copy the retired drop-level TN onto every accepted seat (infer carrier).
    op.execute(
        sa.text(
            """
            INSERT INTO drop_application_shipments
                (id, application_id, tracking_number, carrier, created_at)
            SELECT
                gen_random_uuid(),
                a.id,
                d.tracking_number,
                CASE
                    WHEN upper(d.tracking_number) LIKE '1Z%' THEN 'ups'
                    WHEN d.tracking_number ~ '^[0-9]{12,22}$' THEN 'fedex'
                    ELSE 'unknown'
                END,
                now()
            FROM drop_applications a
            JOIN drops d ON d.id = a.drop_id
            WHERE a.decision = 'accepted'
              AND d.tracking_number IS NOT NULL
              AND btrim(d.tracking_number) <> ''
            """
        )
    )


def downgrade() -> None:
    op.drop_index(
        "ix_drop_application_shipments_application_id",
        table_name="drop_application_shipments",
    )
    op.drop_table("drop_application_shipments")
