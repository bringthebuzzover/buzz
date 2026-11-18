"""Count the brand's "Choose your orgs" emails per drop.

Revision ID: c3e5a7b9d1f2
Revises: b8d2f4a6c1e3
Create Date: 2026-10-29 16:00:00.000000

Additive and backfilled: drops whose applications already closed count as
fully reminded (3), so deploying this never mails a brand about an old drop.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3e5a7b9d1f2"
down_revision: Union[str, Sequence[str], None] = "b8d2f4a6c1e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "drops",
        sa.Column("choose_orgs_emails_sent", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
    )
    op.execute("UPDATE drops SET choose_orgs_emails_sent = 3 WHERE apply_close_at <= now()")


def downgrade() -> None:
    op.drop_column("drops", "choose_orgs_emails_sent")
