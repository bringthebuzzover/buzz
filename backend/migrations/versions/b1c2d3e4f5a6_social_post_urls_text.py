"""Store social post URLs as text.

Instagram signed CDN links for media and thumbnails exceed varchar(1024)
and aborted metric sync (and admin sync-and-autolink) on insert.

Revision ID: b1c2d3e4f5a6
Revises: a0b1c2d3e4f5
Create Date: 2026-09-28 16:05:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "a0b1c2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = ("url", "media_url", "thumbnail_url")


def upgrade() -> None:
    for column in _COLUMNS:
        op.alter_column(
            "social_posts",
            column,
            existing_type=sa.String(1024),
            type_=sa.Text(),
            existing_nullable=column != "url",
        )


def downgrade() -> None:
    for column in _COLUMNS:
        op.alter_column(
            "social_posts",
            column,
            existing_type=sa.Text(),
            type_=sa.String(1024),
            existing_nullable=column != "url",
            postgresql_using=f"left({column}, 1024)",
        )
