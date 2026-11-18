"""One open Instagram ticket per org: widen the partial unique index.

``uq_org_ig_change_requests_one_pending`` only covered ``status = 'pending'``.
This PR keeps an org ``active`` while its approved account switch waits for the
reconnect, and tracks that wait on ``org_ig_change_requests.status =
'awaiting_connect'``. Two open states now exist, and the old predicate left the
second one unguarded: approving a switch (``pending`` → ``awaiting_connect``)
frees the ``pending`` slot, so a second request could be submitted and approved
while the first reconnect was outstanding. Two live ``awaiting_connect`` rows
then let one bind close both, and ``latest_approved_switch`` could report a
handle the org never bound.

The index is renamed to ``uq_org_ig_change_requests_one_open`` and widened to
``status IN ('pending', 'awaiting_connect')`` so the database — not only
``services.ig_change_requests`` — enforces one open ticket per organization.
``app.models.org_ig_change_request`` declares the same name and predicate, so
``alembic check`` stays clean.

Existing duplicates must be collapsed first or the unique index cannot be
built. For each org with more than one open ticket the newest
``awaiting_connect`` row is kept and every other open row is marked ``denied``:
it was never honoured and can no longer be, so it must not read as a live
switch. No row is deleted, and the denied rows stay visible to admins.

Reverse with ``alembic downgrade d7e8f9a0b1c2``: the widened index is dropped
and the original ``status = 'pending'`` index is recreated under its old name.
That always succeeds, because the wider predicate is strictly stronger than the
narrower one. The duplicate collapse is NOT reverted — which of the stacked
tickets was authoritative cannot be reconstructed — so a downgraded database
keeps those rows at ``denied``. Old code is unaffected by that: it reads
``pending_instagram`` users plus ``approved`` requests.
"""

import sqlalchemy as sa
from alembic import op

revision = "e9f0a1b2c3d5"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None

_TABLE = "org_ig_change_requests"
_OLD_INDEX = "uq_org_ig_change_requests_one_pending"
_NEW_INDEX = "uq_org_ig_change_requests_one_open"
_OLD_PREDICATE = "status = 'pending'"
_NEW_PREDICATE = "status IN ('pending', 'awaiting_connect')"


def upgrade() -> None:
    # Collapse pre-existing stacked tickets before the unique index can apply.
    op.execute(f"""
        WITH ranked AS (
            SELECT
                id,
                row_number() OVER (
                    PARTITION BY org_id
                    ORDER BY (status = 'awaiting_connect') DESC,
                             decided_at DESC NULLS LAST,
                             created_at DESC,
                             id
                ) AS rn
            FROM {_TABLE}
            WHERE {_NEW_PREDICATE}
        )
        UPDATE {_TABLE} r
        SET status = 'denied', decided_at = coalesce(r.decided_at, now())
        FROM ranked x
        WHERE r.id = x.id AND x.rn > 1
        """)
    op.drop_index(_OLD_INDEX, table_name=_TABLE)
    op.create_index(
        _NEW_INDEX,
        _TABLE,
        ["org_id"],
        unique=True,
        postgresql_where=sa.text(_NEW_PREDICATE),
    )


def downgrade() -> None:
    op.drop_index(_NEW_INDEX, table_name=_TABLE)
    op.create_index(
        _OLD_INDEX,
        _TABLE,
        ["org_id"],
        unique=True,
        postgresql_where=sa.text(_OLD_PREDICATE),
    )
