"""Drop lifecycle: per-seat sent decisions, wrapped_at, computed stage.

Revision ID: a7c1e3f5b9d2
Revises: f0a1b2c3d4e5
Create Date: 2026-10-29 14:00:00.000000

Additive and backfilled; old columns stay (unread) until a later drop.

* ``drop_applications.decision_sent_at`` — every decided seat that exists
  today was already communicated (batch finalize or late-add), so it is
  backfilled from ``decision_at``.
* ``drops.wrapped_at`` — finished drops get the time of their last
  ``drop_finished`` tracker event, else their finalize or close time. Never
  "now": that would reopen org linking and metric sync on long-finished
  drops for the grace windows.
* ``drops.brand_tracker_stage`` becomes nullable (no longer written).
* ``manual_reopen`` stops existing as a behaviour: a reopened, unwrapped
  drop keeps accepting applications by moving its close date to at least
  7 days from now. A finalized drop whose close date was later pushed past
  its finalize time is closed at finalize time, as it was in practice.
* ``drop_tracker_events.stage`` becomes plain text so the log can record the
  new computed stages.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7c1e3f5b9d2"
down_revision: Union[str, Sequence[str], None] = "f0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "drop_applications",
        sa.Column("decision_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE drop_applications SET decision_sent_at = COALESCE(decision_at, applied_at) "
        "WHERE decision <> 'applied'"
    )

    op.add_column("drops", sa.Column("wrapped_at", sa.DateTime(timezone=True), nullable=True))
    op.execute(
        """
        UPDATE drops SET wrapped_at = COALESCE(
            (SELECT max(e.occurred_at) FROM drop_tracker_events e
             WHERE e.drop_id = drops.id AND e.stage = 'drop_finished'),
            applicant_selection_finalized_at,
            apply_close_at)
        WHERE brand_tracker_stage = 'drop_finished'
        """
    )
    op.alter_column("drops", "brand_tracker_stage", nullable=True)

    op.execute(
        """
        UPDATE drops SET apply_close_at = GREATEST(apply_close_at, now() + interval '7 days')
        WHERE manual_reopen AND wrapped_at IS NULL
        """
    )
    op.execute(
        """
        UPDATE drops SET apply_close_at = GREATEST(
            applicant_selection_finalized_at, apply_open_at + interval '1 second')
        WHERE applicant_selection_finalized_at IS NOT NULL
          AND NOT manual_reopen
          AND apply_close_at > applicant_selection_finalized_at
        """
    )
    op.execute("UPDATE drops SET manual_reopen = false WHERE manual_reopen")

    op.alter_column(
        "drop_tracker_events",
        "stage",
        type_=sa.String(length=32),
        postgresql_using="stage::text",
        existing_nullable=False,
    )


def downgrade() -> None:
    op.execute(
        "UPDATE drop_tracker_events SET stage = 'awaiting_products' "
        "WHERE stage NOT IN ('request_received', 'finalizing_agreements', "
        "'awaiting_products', 'drop_active', 'drop_finished')"
    )
    op.alter_column(
        "drop_tracker_events",
        "stage",
        type_=sa.Enum(name="brand_tracker_stage", create_type=False),
        postgresql_using="stage::brand_tracker_stage",
        existing_nullable=False,
    )
    op.execute(
        "UPDATE drops SET brand_tracker_stage = CASE "
        "WHEN wrapped_at IS NOT NULL THEN 'drop_finished'::brand_tracker_stage "
        "ELSE 'awaiting_products'::brand_tracker_stage END "
        "WHERE brand_tracker_stage IS NULL OR wrapped_at IS NOT NULL"
    )
    op.alter_column("drops", "brand_tracker_stage", nullable=False)
    op.drop_column("drops", "wrapped_at")
    op.drop_column("drop_applications", "decision_sent_at")
