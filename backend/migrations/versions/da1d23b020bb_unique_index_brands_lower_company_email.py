"""unique index brands lower company_email

Revision ID: da1d23b020bb
Revises: 645b8aa4a5f2
Create Date: 2026-06-06 14:09:49.899540

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da1d23b020bb'
down_revision: Union[str, Sequence[str], None] = '645b8aa4a5f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Case-insensitive uniqueness: one brand account per company email. A plain
    # UNIQUE would let Brand@x.com and brand@x.com both register; the functional
    # index on lower(company_email) closes that and the concurrent-insert race.
    op.create_index(
        "uq_brands_company_email_lower",
        "brands",
        [sa.text("lower(company_email)")],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("uq_brands_company_email_lower", table_name="brands")
