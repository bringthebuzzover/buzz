"""brand_apply_contact_and_budget

Revision ID: 3fc54408aba0
Revises: a8b9c0d1e2f3
Create Date: 2026-11-10 00:33:17.342474

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3fc54408aba0"
down_revision: Union[str, Sequence[str], None] = "a8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("brands", sa.Column("contact_name", sa.String(length=255), nullable=True))
    op.add_column("brands", sa.Column("marketing_budget", sa.String(length=16), nullable=True))

    op.create_check_constraint(
        "ck_brands_marketing_budget",
        "brands",
        "marketing_budget IS NULL OR "
        "marketing_budget IN ('5_20k','20k_50k','50k_100k','100k_plus')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("ck_brands_marketing_budget", "brands", type_="check")
    op.drop_column("brands", "marketing_budget")
    op.drop_column("brands", "contact_name")
