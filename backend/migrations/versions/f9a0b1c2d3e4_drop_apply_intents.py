"""Add drop_apply_intents (signup intent, not applicants).

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-09-16 11:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f9a0b1c2d3e4"
down_revision: Union[str, Sequence[str], None] = "e8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INTENT_STATUS = postgresql.ENUM(
    "open",
    "expired",
    "promoted",
    name="drop_apply_intent_status",
    create_type=False,
)


def upgrade() -> None:
    _INTENT_STATUS.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "drop_apply_intents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("drop_id", sa.Uuid(), nullable=False),
        sa.Column("pitch", sa.Text(), nullable=True),
        sa.Column("status", _INTENT_STATUS, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["drop_id"], ["drops.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "drop_id", name="uq_drop_apply_intents_org_drop"),
    )
    op.create_index("ix_drop_apply_intents_org_id", "drop_apply_intents", ["org_id"])
    op.create_index("ix_drop_apply_intents_drop_id", "drop_apply_intents", ["drop_id"])


def downgrade() -> None:
    op.drop_index("ix_drop_apply_intents_drop_id", table_name="drop_apply_intents")
    op.drop_index("ix_drop_apply_intents_org_id", table_name="drop_apply_intents")
    op.drop_table("drop_apply_intents")
    _INTENT_STATUS.drop(op.get_bind(), checkfirst=True)
