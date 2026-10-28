"""Withdraw campaign participation for orgs already erased.

Revision ID: c8d9e0f1a2b3
Revises: c4d5e6f7a8b9
Create Date: 2026-10-28 12:30:00.000000

Orgs erased before this revision still have accepted applications, links,
and social_posts metrics (the old keep-KPI rule). Brand totals sum those
rows live, so the tombstone org keeps counting.

This runs the same idempotent deletes as erase (``cleanup_statements``
mode ``all_erased``): suggestions, links, shipments, applications, posts,
notify_me, and ``organizations.follower_count``. The user and organization
rows stay. Downgrade cannot put the deleted rows back. Do not run this
by hand against production; deploy applies it.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from app.services.erased_org_participation import cleanup_statements

    for statement in cleanup_statements("all_erased"):
        op.execute(sa.text(statement))


def downgrade() -> None:
    # Deleted participation and metric rows are not recoverable.
    pass
