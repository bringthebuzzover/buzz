"""add organizations.category org_category enum

Revision ID: f5058547fe53
Revises: 00f8ab49f469
Create Date: 2026-06-07 09:14:34.067822

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5058547fe53'
down_revision: Union[str, Sequence[str], None] = '00f8ab49f469'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ``create_type=False`` so the column DDL doesn't try to manage the type — we
# CREATE/DROP it explicitly below. Unlike ``create_table``, an ``ADD COLUMN`` does
# NOT auto-emit ``CREATE TYPE``, so the type must be created first by hand.
org_category = sa.Enum(
    "sorority",
    "fraternity",
    "sports",
    "academic",
    "social",
    "other",
    name="org_category",
    create_type=False,
)


def upgrade() -> None:
    """Upgrade schema."""
    org_category.create(op.get_bind(), checkfirst=True)
    op.add_column("organizations", sa.Column("category", org_category, nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("organizations", "category")
    # Alembic does not drop the PG enum type on column drop — do it explicitly so
    # a re-`upgrade head` doesn't fail with "type org_category already exists"
    # (matches the initial-schema downgrade pattern in 0392d8ea3a28).
    org_category.drop(op.get_bind(), checkfirst=True)
