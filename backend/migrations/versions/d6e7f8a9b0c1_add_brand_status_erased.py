"""Add brand_status.erased for admin brand hybrid erase

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-09-13 20:00:00.000000

Appends ``erased`` to the ``brand_status`` PG enum (PRODUCT §3.1.3).
Downgrade is a no-op — dropping an enum value requires rebuilding the type.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "d6e7f8a9b0c1"
down_revision: Union[str, Sequence[str], None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE brand_status ADD VALUE IF NOT EXISTS 'erased'")


def downgrade() -> None:
    # PG cannot drop an enum value in place; leave 'erased' in the type.
    pass
