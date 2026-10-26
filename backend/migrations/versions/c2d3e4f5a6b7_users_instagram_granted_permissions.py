"""Add users.instagram_granted_permissions.

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-10-26 18:20:00.000000

Nullable text of the scopes Meta returned on the Instagram code exchange
(``permissions``). Existing rows stay null until the next org login.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("instagram_granted_permissions", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "instagram_granted_permissions")
