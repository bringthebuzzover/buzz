"""Add nullable structured columns on drop_requests.

Revision ID: f2a3b4c5d6e7
Revises: e0f1a2b3c4d5
Create Date: 2026-10-29 00:30:00.000000

Existing tickets only have message and notes. Every new column is nullable
so those rows stay valid. ``product`` is required on create in the API, not
in the database.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, Sequence[str], None] = "e0f1a2b3c4d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("drop_requests", sa.Column("product", sa.String(length=1000), nullable=True))
    op.add_column("drop_requests", sa.Column("title", sa.String(length=120), nullable=True))
    op.add_column("drop_requests", sa.Column("location", sa.String(length=255), nullable=True))
    op.add_column("drop_requests", sa.Column("target_date", sa.Date(), nullable=True))
    op.add_column("drop_requests", sa.Column("org_count", sa.Integer(), nullable=True))
    op.add_column("drop_requests", sa.Column("units_per_org", sa.Integer(), nullable=True))
    op.add_column(
        "drop_requests", sa.Column("campaign_hashtag", sa.String(length=100), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("drop_requests", "campaign_hashtag")
    op.drop_column("drop_requests", "units_per_org")
    op.drop_column("drop_requests", "org_count")
    op.drop_column("drop_requests", "target_date")
    op.drop_column("drop_requests", "location")
    op.drop_column("drop_requests", "title")
    op.drop_column("drop_requests", "product")
