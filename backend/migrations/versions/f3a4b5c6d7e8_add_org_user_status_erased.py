"""Add org_user_status.erased for admin org hybrid erase

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-08-11 15:15:00.000000

Appends ``erased`` to the ``org_user_status`` PG enum (PRODUCT §3.1.2).
Downgrade is a no-op — dropping an enum value requires rebuilding the type.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, Sequence[str], None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE org_user_status ADD VALUE IF NOT EXISTS 'erased'")


def downgrade() -> None:
    # PG cannot drop an enum value in place; leave 'erased' in the type.
    pass
