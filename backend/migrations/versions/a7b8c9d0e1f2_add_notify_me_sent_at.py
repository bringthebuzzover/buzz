"""Add notify_me.sent_at for reminder delivery

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-08-03 20:30:00.000000

``notify_reminders`` (architecture §10.6) stamps this once it has emailed the
subscriber, which is what makes the job idempotent on a 5-minute cron. Rows
predating the job stay NULL and get one catch-up email on the first run.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notify_me",
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("notify_me", "sent_at")
