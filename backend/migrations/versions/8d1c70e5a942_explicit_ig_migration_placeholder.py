"""Explicitly identify retirement-migration reconnect placeholders.

Equal handles also describe an admin-authorized return to the original account,
so equality must no longer exempt a ticket from target enforcement. Backfill
only the exact ticket signature synthesized by d7e8f9a0b1c2; ordinary tickets
default to strict target enforcement. Retargeting clears the exemption.
"""

import sqlalchemy as sa
from alembic import op

revision = "8d1c70e5a942"
down_revision = "e9f0a1b2c3d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "org_ig_change_requests",
        sa.Column(
            "is_migration_placeholder", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.execute("""
        UPDATE org_ig_change_requests
        SET is_migration_placeholder = true
        WHERE kind = 'account_switch' AND decided_kind = 'account_switch'
          AND current_handle = requested_handle
          AND created_at = decided_at
          AND reason = 'Reconnect required by the Instagram-first migration: this '
                       'organization was approved under the retired pending_instagram '
                       'flow and never connected Instagram. Bind the account it claimed.'
        """)


def downgrade() -> None:
    op.drop_column("org_ig_change_requests", "is_migration_placeholder")
