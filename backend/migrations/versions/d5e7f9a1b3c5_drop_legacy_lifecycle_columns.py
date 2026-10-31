"""Drop the legacy drop lifecycle columns.

Revision ID: d5e7f9a1b3c5
Revises: c3e5a7b9d1f2
Create Date: 2026-10-31 16:00:00.000000

Downgrade restores the schema, not the discarded values. The tracker stage
stays nullable, as it was at the parent revision, for drops created since.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d5e7f9a1b3c5"
down_revision: Union[str, Sequence[str], None] = "c3e5a7b9d1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TRACKER_STAGE = postgresql.ENUM(
    "request_received",
    "finalizing_agreements",
    "awaiting_products",
    "drop_active",
    "drop_finished",
    name="brand_tracker_stage",
    create_type=False,
)


def upgrade() -> None:
    op.drop_column("drops", "brand_tracker_stage")
    op.drop_column("drops", "manual_reopen")
    op.drop_column("drops", "applicant_selection_finalized_at")
    op.drop_column("drops", "tracking_number")
    _TRACKER_STAGE.drop(op.get_bind())


def downgrade() -> None:
    _TRACKER_STAGE.create(op.get_bind())
    op.add_column("drops", sa.Column("brand_tracker_stage", _TRACKER_STAGE, nullable=True))
    op.add_column(
        "drops",
        sa.Column("manual_reopen", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "drops",
        sa.Column("applicant_selection_finalized_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("drops", sa.Column("tracking_number", sa.String(length=255), nullable=True))
