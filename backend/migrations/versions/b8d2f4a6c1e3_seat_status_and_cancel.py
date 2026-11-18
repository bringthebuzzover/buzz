"""Seat status (withdrew, removed), delivered, added_by, and drop cancel.

Revision ID: b8d2f4a6c1e3
Revises: a7c1e3f5b9d2
Create Date: 2026-10-29 15:00:00.000000

Additive and backfilled:

* ``application_decision`` gains ``withdrew`` and ``removed`` (soft ends; the
  row, shipments and posts stay).
* ``uq_drop_application_active`` lets a ``withdrew`` row re-apply like a
  ``denied`` one.
* ``drop_applications.added_by`` (``apply`` | ``late_add``). Backfill: an
  accepted seat whose decision is stamped at its own apply time was written
  by a late-add (``add_org_to_drop`` sets both to the same instant).
* ``drop_applications.delivered_at`` and ``end_reason`` start empty.
* ``drops.canceled_at`` starts empty (no drop is canceled today).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8d2f4a6c1e3"
down_revision: Union[str, Sequence[str], None] = "a7c1e3f5b9d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New enum values must be committed before the index predicate uses them.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE application_decision ADD VALUE IF NOT EXISTS 'withdrew'")
        op.execute("ALTER TYPE application_decision ADD VALUE IF NOT EXISTS 'removed'")

    op.drop_index("uq_drop_application_active", table_name="drop_applications")
    op.create_index(
        "uq_drop_application_active",
        "drop_applications",
        ["drop_id", "org_id"],
        unique=True,
        postgresql_where=sa.text("decision NOT IN ('denied', 'withdrew')"),
    )

    op.add_column(
        "drop_applications",
        sa.Column("added_by", sa.String(length=16), nullable=False, server_default="apply"),
    )
    op.create_check_constraint(
        "ck_drop_applications_added_by",
        "drop_applications",
        "added_by IN ('apply', 'late_add')",
    )
    op.execute(
        "UPDATE drop_applications SET added_by = 'late_add' "
        "WHERE decision = 'accepted' AND decision_at = applied_at"
    )
    op.add_column(
        "drop_applications",
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("drop_applications", sa.Column("end_reason", sa.Text(), nullable=True))
    op.add_column("drops", sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("drops", "canceled_at")
    op.drop_column("drop_applications", "end_reason")
    op.drop_column("drop_applications", "delivered_at")
    op.drop_constraint("ck_drop_applications_added_by", "drop_applications", type_="check")
    op.drop_column("drop_applications", "added_by")
    # Postgres cannot drop enum values; ended seats fall back to denied.
    op.execute(
        "UPDATE drop_applications SET decision = 'denied' "
        "WHERE decision IN ('withdrew', 'removed')"
    )
    op.drop_index("uq_drop_application_active", table_name="drop_applications")
    op.create_index(
        "uq_drop_application_active",
        "drop_applications",
        ["drop_id", "org_id"],
        unique=True,
        postgresql_where=sa.text("decision <> 'denied'"),
    )
