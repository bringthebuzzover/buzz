"""collapse brand_tracker_stage from 7 to 5 values (architecture §8.5)

Revision ID: a03e0feb130c
Revises: 0392d8ea3a28
Create Date: 2026-06-03 21:01:36.627285

PostgreSQL can't alter or drop individual enum values, so the recipe is:

1. CREATE TYPE with the 5 new values.
2. ALTER both columns that use the type (drops.brand_tracker_stage,
   drop_tracker_events.stage) via USING (CASE ...).
3. DROP the old type.
4. RENAME the new type to the canonical name.

The downgrade is **lossy** — the 7→5 collapse merged ``approved`` into
``finalizing_agreements`` and ``delivered`` into ``awaiting_products``;
downgrading maps them back to a single old value each, losing the
distinction.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "a03e0feb130c"
down_revision: Union[str, Sequence[str], None] = "0392d8ea3a28"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_VALUES = (
    "request_received",
    "finalizing_agreements",
    "awaiting_products",
    "drop_active",
    "drop_finished",
)
_OLD_VALUES = (
    "awaiting_brief",
    "in_review",
    "approved",
    "shipped",
    "delivered",
    "active",
    "finished",
)

# Template with ``{col}`` so the same CASE works for both columns
# without a naive .replace() that corrupts the type-cast names.
_UPGRADE_CASE = """CASE
    WHEN {col} = 'awaiting_brief' THEN 'request_received'::brand_tracker_stage_new
    WHEN {col} = 'in_review' THEN 'finalizing_agreements'::brand_tracker_stage_new
    WHEN {col} = 'approved' THEN 'finalizing_agreements'::brand_tracker_stage_new
    WHEN {col} = 'shipped' THEN 'awaiting_products'::brand_tracker_stage_new
    WHEN {col} = 'delivered' THEN 'awaiting_products'::brand_tracker_stage_new
    WHEN {col} = 'active' THEN 'drop_active'::brand_tracker_stage_new
    WHEN {col} = 'finished' THEN 'drop_finished'::brand_tracker_stage_new
END"""

# 5→7 mapping (downgrade, lossy)
_DOWNGRADE_CASE = """CASE
    WHEN {col} = 'request_received' THEN 'awaiting_brief'::brand_tracker_stage_old
    WHEN {col} = 'finalizing_agreements' THEN 'in_review'::brand_tracker_stage_old
    WHEN {col} = 'awaiting_products' THEN 'shipped'::brand_tracker_stage_old
    WHEN {col} = 'drop_active' THEN 'active'::brand_tracker_stage_old
    WHEN {col} = 'drop_finished' THEN 'finished'::brand_tracker_stage_old
END"""


def upgrade() -> None:
    op.execute(
        f"CREATE TYPE brand_tracker_stage_new AS ENUM "
        f"({', '.join(repr(v) for v in _NEW_VALUES)})"
    )
    op.execute(
        f"ALTER TABLE drops ALTER COLUMN brand_tracker_stage "
        f"TYPE brand_tracker_stage_new "
        f"USING ({_UPGRADE_CASE.format(col='brand_tracker_stage')})"
    )
    op.execute(
        f"ALTER TABLE drop_tracker_events ALTER COLUMN stage "
        f"TYPE brand_tracker_stage_new "
        f"USING ({_UPGRADE_CASE.format(col='stage')})"
    )
    op.execute("DROP TYPE brand_tracker_stage")
    op.execute("ALTER TYPE brand_tracker_stage_new RENAME TO brand_tracker_stage")


def downgrade() -> None:
    op.execute(
        f"CREATE TYPE brand_tracker_stage_old AS ENUM "
        f"({', '.join(repr(v) for v in _OLD_VALUES)})"
    )
    op.execute(
        f"ALTER TABLE drops ALTER COLUMN brand_tracker_stage "
        f"TYPE brand_tracker_stage_old "
        f"USING ({_DOWNGRADE_CASE.format(col='brand_tracker_stage')})"
    )
    op.execute(
        f"ALTER TABLE drop_tracker_events ALTER COLUMN stage "
        f"TYPE brand_tracker_stage_old "
        f"USING ({_DOWNGRADE_CASE.format(col='stage')})"
    )
    op.execute("DROP TYPE brand_tracker_stage")
    op.execute("ALTER TYPE brand_tracker_stage_old RENAME TO brand_tracker_stage")
