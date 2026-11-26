"""Store optional discovery sources on brand and organization signups."""

import sqlalchemy as sa
from alembic import op

revision = "b61e3a7c24d0"
down_revision = "8d1c70e5a942"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("brands", "organizations"):
        op.add_column(table, sa.Column("how_found", sa.String(16), nullable=True))
        op.add_column(table, sa.Column("how_found_other", sa.String(120), nullable=True))


def downgrade() -> None:
    for table in ("organizations", "brands"):
        op.drop_column(table, "how_found_other")
        op.drop_column(table, "how_found")
