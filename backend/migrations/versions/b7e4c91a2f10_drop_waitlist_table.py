"""drop waitlist table and waitlist_entity_type enum

Revision ID: b7e4c91a2f10
Revises: f5058547fe53
Create Date: 2026-08-03 05:20:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7e4c91a2f10"
down_revision: Union[str, Sequence[str], None] = "f5058547fe53"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("waitlist")
    sa.Enum(name="waitlist_entity_type").drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    waitlist_entity_type = sa.Enum("brand", "org", name="waitlist_entity_type")
    waitlist_entity_type.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "waitlist",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("submitter_name", sa.String(length=255), nullable=False),
        sa.Column("entity_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("entity_type", waitlist_entity_type, nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
