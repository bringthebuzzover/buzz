"""Add structured US shipping columns on organizations.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-31 19:15:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("shipping_line1", sa.String(length=255), nullable=True))
    op.add_column("organizations", sa.Column("shipping_line2", sa.String(length=255), nullable=True))
    op.add_column("organizations", sa.Column("shipping_city", sa.String(length=255), nullable=True))
    op.add_column("organizations", sa.Column("shipping_state", sa.String(length=2), nullable=True))
    op.add_column(
        "organizations", sa.Column("shipping_postal_code", sa.String(length=10), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("organizations", "shipping_postal_code")
    op.drop_column("organizations", "shipping_state")
    op.drop_column("organizations", "shipping_city")
    op.drop_column("organizations", "shipping_line2")
    op.drop_column("organizations", "shipping_line1")
