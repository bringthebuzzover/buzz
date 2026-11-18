"""Add reviewed org shipping changes and immutable shipment destinations.

Revision ID: a8b9c0d1e2f3
Revises: d5e7f9a1b3c5
Create Date: 2026-11-02 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, Sequence[str], None] = "d5e7f9a1b3c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JSONB = postgresql.JSONB(astext_type=sa.Text())


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("shipping_address_version", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("drop_application_shipments", sa.Column("shipping_address_snapshot", JSONB, nullable=True))
    op.add_column(
        "drop_application_shipments",
        sa.Column("shipping_address_captured_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "org_shipping_change_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("requester_user_id", sa.Uuid(), nullable=False),
        sa.Column("reviewer_user_id", sa.Uuid(), nullable=True),
        sa.Column("current_address", JSONB, nullable=True),
        sa.Column("requested_address", JSONB, nullable=True),
        sa.Column("base_address_version", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="pending", nullable=False),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("redacted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'denied')",
            name="ck_org_shipping_change_requests_status",
        ),
        sa.CheckConstraint(
            "(status = 'pending' AND decided_at IS NULL) OR "
            "(status IN ('approved', 'denied') AND decided_at IS NOT NULL)",
            name="ck_org_shipping_change_requests_decision",
        ),
        sa.CheckConstraint(
            "redacted_at IS NOT NULL OR "
            "(current_address IS NOT NULL AND requested_address IS NOT NULL AND reason IS NOT NULL)",
            name="ck_org_shipping_change_requests_sensitive_fields",
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewer_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_org_shipping_change_requests_org_id",
        "org_shipping_change_requests",
        ["org_id"],
    )
    op.create_index(
        "uq_org_shipping_change_requests_one_pending",
        "org_shipping_change_requests",
        ["org_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_org_shipping_change_requests_one_pending",
        table_name="org_shipping_change_requests",
    )
    op.drop_index(
        "ix_org_shipping_change_requests_org_id",
        table_name="org_shipping_change_requests",
    )
    op.drop_table("org_shipping_change_requests")
    op.drop_column("drop_application_shipments", "shipping_address_captured_at")
    op.drop_column("drop_application_shipments", "shipping_address_snapshot")
    op.drop_column("organizations", "shipping_address_version")
