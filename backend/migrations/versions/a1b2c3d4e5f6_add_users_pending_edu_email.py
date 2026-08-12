"""Add users.pending_edu_email for post-verify .edu rotate (pending-swap).

Revision ID: a1b2c3d4e5f6
Revises: f3a4b5c6d7e8
Create Date: 2026-08-11 18:00:00.000000

Nullable unique latch for a new campus email while the live ``edu_email``
remains the login/contact identity until the verification link is confirmed
(PRODUCT §3.1 / gap org.edu-email-change-after-verify).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("pending_edu_email", sa.String(length=320), nullable=True),
    )
    op.create_unique_constraint(
        "uq_users_pending_edu_email",
        "users",
        ["pending_edu_email"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_pending_edu_email", "users", type_="unique")
    op.drop_column("users", "pending_edu_email")
