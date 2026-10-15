"""Creator-only drops and a creator owner on applications.

Revision ID: e4f5a6b7c8d0
Revises: d3e4f5a6b7c8
Create Date: 2026-10-15 19:00:00.000000

Does not publish through the org tracker. Org rows keep audience ``orgs``.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e4f5a6b7c8d0"
down_revision: Union[str, Sequence[str], None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "drops",
        sa.Column("audience", sa.String(length=16), server_default="orgs", nullable=False),
    )
    op.add_column("drops", sa.Column("creator_cap", sa.Integer(), nullable=True))
    op.add_column("drops", sa.Column("creator_gross", sa.Integer(), nullable=True))
    op.alter_column("drops", "image", existing_type=sa.String(length=1024), nullable=True)
    op.alter_column("drop_applications", "org_id", existing_type=sa.Uuid(), nullable=True)
    op.add_column("drop_applications", sa.Column("creator_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_drop_applications_creator_id",
        "drop_applications",
        "creators",
        ["creator_id"],
        ["id"],
    )
    op.create_check_constraint(
        "ck_drop_applications_one_owner",
        "drop_applications",
        "(org_id IS NOT NULL AND creator_id IS NULL) OR "
        "(org_id IS NULL AND creator_id IS NOT NULL)",
    )
    op.execute("DROP INDEX IF EXISTS uq_drop_application_active")
    op.create_index(
        "uq_drop_application_active",
        "drop_applications",
        ["drop_id", "org_id"],
        unique=True,
        postgresql_where=sa.text("decision <> 'denied' AND org_id IS NOT NULL"),
    )
    op.create_index(
        "uq_drop_application_active_creator",
        "drop_applications",
        ["drop_id", "creator_id"],
        unique=True,
        postgresql_where=sa.text("decision <> 'denied' AND creator_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_drop_application_active_creator", table_name="drop_applications")
    op.execute("DROP INDEX IF EXISTS uq_drop_application_active")
    op.create_index(
        "uq_drop_application_active",
        "drop_applications",
        ["drop_id", "org_id"],
        unique=True,
        postgresql_where=sa.text("decision <> 'denied'"),
    )
    op.drop_constraint("ck_drop_applications_one_owner", "drop_applications", type_="check")
    op.drop_constraint("fk_drop_applications_creator_id", "drop_applications", type_="foreignkey")
    op.drop_column("drop_applications", "creator_id")
    op.alter_column("drop_applications", "org_id", existing_type=sa.Uuid(), nullable=False)
    op.alter_column("drops", "image", existing_type=sa.String(length=1024), nullable=False)
    op.drop_column("drops", "creator_gross")
    op.drop_column("drops", "creator_cap")
    op.drop_column("drops", "audience")
