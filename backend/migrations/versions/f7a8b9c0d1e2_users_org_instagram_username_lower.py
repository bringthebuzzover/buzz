"""Partial unique index on claimed org Instagram handle.

Revision ID: f7a8b9c0d1e2
Revises: b0c1d2e3f4a5
Create Date: 2026-09-12 13:10:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "b0c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_WHERE = sa.text("portal_role = 'org' AND status <> 'erased' AND instagram_username IS NOT NULL")
# Same key as migrations/env.py — session-scoped so it survives the COMMIT
# inside autocommit_block (pg_advisory_xact_lock does not).
_ALEMBIC_ADVISORY_LOCK_KEY = 737841


def upgrade() -> None:
    """Upgrade schema."""
    # Case-insensitive uniqueness among non-erased orgs. Apply-time SELECT is
    # not enough under concurrent insert; erased rows can still free the handle.
    #
    # 'erased' was ADD VALUE'd in f3a4b5c6d7e8. A fresh ``upgrade head`` is one
    # transaction, and PG forbids using that label in an index predicate until
    # the ADD VALUE commits (UnsafeNewEnumValueUsageError). autocommit_block
    # commits earlier revisions; the session lock keeps api+cron serialized.
    op.execute(sa.text(f"SELECT pg_advisory_lock({_ALEMBIC_ADVISORY_LOCK_KEY})"))
    try:
        with op.get_context().autocommit_block():
            op.create_index(
                "uq_users_org_instagram_username_lower",
                "users",
                [sa.text("lower(instagram_username)")],
                unique=True,
                postgresql_where=_WHERE,
                if_not_exists=True,
            )
    finally:
        op.execute(sa.text(f"SELECT pg_advisory_unlock({_ALEMBIC_ADVISORY_LOCK_KEY})"))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        "uq_users_org_instagram_username_lower",
        table_name="users",
        postgresql_where=_WHERE,
    )
