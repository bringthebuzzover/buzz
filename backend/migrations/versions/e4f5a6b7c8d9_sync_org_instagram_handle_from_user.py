"""Sync organizations.instagram_handle from users.instagram_username

Revision ID: e4f5a6b7c8d9
Revises: d2e3f4a5b6c7
Create Date: 2026-08-03 18:00:00.000000

Org portal identity is the Instagram OAuth login account. Repair any drift
where organizations.instagram_handle diverged from users.instagram_username
(e.g. editable onboarding/PATCH before the lock). Leading ``@`` is stripped.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, Sequence[str], None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE organizations AS o
        SET instagram_handle = ltrim(u.instagram_username, '@')
        FROM users AS u
        WHERE o.user_id = u.id
          AND u.instagram_username IS NOT NULL
          AND btrim(u.instagram_username) <> ''
          AND o.instagram_handle IS DISTINCT FROM ltrim(btrim(u.instagram_username), '@')
        """
    )


def downgrade() -> None:
    # Data repair is not reversible — drifted handles are not recoverable.
    pass
