"""Move reconnect eligibility from user status to approved switch requests.

PostgreSQL cannot remove an enum label in place. Keep the dormant label in the
DB type (but remove it from the Python enum), avoiding a users-table rewrite
and rebuilding its status-dependent indexes. No new code writes that label.

Legacy rows: an unbound org with an approved account-switch request owes a
reconnect: flag its latest switch awaiting_connect and make the user active.
Rows with both Graph id and access token become active. All other legacy rows
become pending_approval for explicit admin review; no user/request is deleted.

Reverse with ``alembic downgrade 3fc54408aba0``: outstanding switches return to
pending_instagram and their requests to approved, which the old code understands.
The retained enum label makes this transactional. Other normalized active and
pending_approval rows retain their status on rollback; their former legacy
classification cannot be inferred and is deliberately not recreated.
"""

from alembic import op

revision = "d7e8f9a0b1c2"
down_revision = "3fc54408aba0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE org_ig_change_requests r SET status = 'awaiting_connect'
        WHERE r.id IN (
            SELECT DISTINCT ON (r.org_id) r.id
            FROM org_ig_change_requests r
            JOIN users u ON u.id = r.user_id
            JOIN organizations o ON o.id = r.org_id AND o.user_id = u.id
            WHERE u.status = 'pending_instagram' AND u.portal_role = 'org'
              AND NOT (coalesce(u.instagram_user_id, '') <> ''
                       AND coalesce(u.instagram_access_token, '') <> '')
              AND r.status = 'approved' AND r.decided_kind = 'account_switch'
            ORDER BY r.org_id, r.decided_at DESC NULLS LAST, r.created_at DESC, r.id
        )
        """)
    op.execute("""
        UPDATE users u SET status = CASE
            WHEN (coalesce(u.instagram_user_id, '') <> ''
                  AND coalesce(u.instagram_access_token, '') <> '')
              OR EXISTS (
                SELECT 1 FROM org_ig_change_requests r
                WHERE r.user_id = u.id AND r.status = 'awaiting_connect'
                  AND r.decided_kind = 'account_switch'
              )
            THEN 'active'::org_user_status
            ELSE 'pending_approval'::org_user_status
        END
        WHERE u.status = 'pending_instagram'
        """)


def downgrade() -> None:
    # The label is NOT guaranteed to exist. An earlier migration
    # (b8c9d0e1f2a3) rebuilt this enum type from an explicit label list that
    # omitted 'pending_instagram', so any database created fresh from the
    # migration chain never has it. Writing the value below without adding the
    # label first fails with InvalidTextRepresentationError.
    #
    # ADD VALUE cannot run inside a transaction block on older Postgres, and
    # Alembic wraps migrations in one, so commit the surrounding work first the
    # same way b2c3d4e5f6a7 does.
    op.execute("COMMIT")
    op.execute("ALTER TYPE org_user_status ADD VALUE IF NOT EXISTS 'pending_instagram'")
    op.execute("BEGIN")
    op.execute("""
        UPDATE users u SET status = 'pending_instagram'
        WHERE u.portal_role = 'org' AND u.status = 'active'
          AND EXISTS (
            SELECT 1 FROM org_ig_change_requests r
            WHERE r.user_id = u.id AND r.status = 'awaiting_connect'
              AND r.decided_kind = 'account_switch'
          )
        """)
    op.execute(
        "UPDATE org_ig_change_requests SET status = 'approved' " "WHERE status = 'awaiting_connect'"
    )
