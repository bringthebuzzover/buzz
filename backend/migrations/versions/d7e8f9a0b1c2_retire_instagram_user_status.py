"""Move reconnect eligibility from user status to approved switch requests.

PostgreSQL cannot remove an enum label in place. Keep the dormant label in the
DB type (but remove it from the Python enum), avoiding a users-table rewrite
and rebuilding its status-dependent indexes. No new code writes that label.

Legacy rows fall into four cohorts:

1. **Unbound with an approved switch.** The latest approved account-switch
   ticket is flagged ``awaiting_connect``; the user becomes ``active``.
2. **Connected.** A Graph id *and* an access token are both present, so the
   user simply becomes ``active``.
3. **Unbound, no switch, but a claimed ``instagram_username``.** This is every
   organization approved under the retired apply-first flow that was emailed a
   Connect link and never redeemed it. It must NOT become
   ``pending_approval``: that state is a dead end for them. ``approve_org`` now
   requires live credentials, ``resend_org_connect`` and
   ``bind-start``/``redeem_org_connect_token`` require an open ticket, ordinary
   Instagram OAuth is refused because their own claimed handle already sits on
   their user row (``assert_handle_available``), and re-onboarding needs
   ``pending_org_profile``. They also still hold their ``.edu`` address under a
   unique index, so they cannot re-signup either. Instead, synthesize the exact
   ticket an approved switch would have produced:
   ``kind = decided_kind = 'account_switch'``,
   ``status = 'awaiting_connect'``, and
   ``current_handle = requested_handle = users.instagram_username`` (the handle
   they claimed), with a ``reason`` recording that this ticket came from the
   migration. The user becomes ``active`` with Graph credentials released, so
   the existing admin "resend Connect" action and the bind flow reach them and
   they can complete the reconnect instead of being stranded.
4. **Unbound, no switch, and no claimed handle.** There is nothing to bind
   against, so no ticket is synthesized. The user becomes ``pending_approval``
   rather than ``active``: ``active`` would close the portal against a
   credential gate nothing can satisfy, and no Connect action reaches an active
   org without a ticket. ``pending_approval`` is reachable — the admin "send
   Connect link" action mints a token for an unbound pre-approval org, and
   ``approve_org`` succeeds once it connects. Rows without an
   ``organizations`` row have no org to mint a token for, so they become
   ``active``; no action could reach them in any status.

A ticket is only synthesized when the org has no open (``pending`` or
``awaiting_connect``) ticket, so this never collides with the widened
one-open-ticket index and never overwrites an existing request.

Every statement is INSERT-only or status-guarded, so re-running the upgrade
after a downgrade neither duplicates a ticket nor drops a row: no user and no
request row is deleted.

Reverse with ``alembic downgrade 3fc54408aba0``: every org user left holding an
``awaiting_connect`` account-switch ticket — the switch flagged above and the
ticket synthesized for cohort 3 — returns to ``pending_instagram``, and those
tickets return to ``approved``. That pair is exactly the pre-PR state the old
code understands: approved request + ``pending_instagram`` means "approved,
waiting on Connect", which ``resend_org_connect`` and ``bind-start`` both read.
Connected users stay ``active``.

Deliberately not restored on rollback: users this migration merely made
``active`` (cohorts 1 with a request already ``approved`` after its ticket was
closed, 2 and 4) and any ``active``/``pending_approval`` row that predates this
migration. Their former legacy classification cannot be inferred from the data,
so it is not recreated. The retired enum label is re-added first, so the
downgrade is transactional and always succeeds; rollback never deletes a user
or a request row.
"""

from alembic import op

revision = "d7e8f9a0b1c2"
down_revision = "3fc54408aba0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Cohort 1: flag the latest approved switch so it owes a reconnect.
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
    # Cohort 3: synthesize the reconnect ticket the old apply-first flow should
    # have had, so resend-connect and bind-start can reach these orgs.
    op.execute("""
        INSERT INTO org_ig_change_requests (
            id, org_id, user_id, kind, current_handle, requested_handle, reason,
            status, decided_kind, decided_at, created_at
        )
        SELECT
            gen_random_uuid(), o.id, u.id, 'account_switch',
            -- Both handle columns are varchar(64); Instagram caps at 30, so
            -- left() only guards against a stray over-long legacy value
            -- aborting the whole migration.
            left(u.instagram_username, 64), left(u.instagram_username, 64),
            'Reconnect required by the Instagram-first migration: this '
            'organization was approved under the retired pending_instagram '
            'flow and never connected Instagram. Bind the account it claimed.',
            'awaiting_connect', 'account_switch', now(), now()
        FROM users u
        JOIN organizations o ON o.user_id = u.id
        WHERE u.portal_role = 'org' AND u.status = 'pending_instagram'
          AND NOT (coalesce(u.instagram_user_id, '') <> ''
                   AND coalesce(u.instagram_access_token, '') <> '')
          AND coalesce(btrim(u.instagram_username), '') <> ''
          AND NOT EXISTS (
              SELECT 1 FROM org_ig_change_requests r
              WHERE r.org_id = o.id AND r.status IN ('pending', 'awaiting_connect')
          )
        """)
    # Cohort 2 (connected): active, nothing outstanding.
    op.execute("""
        UPDATE users u SET status = 'active'::org_user_status
        WHERE u.status = 'pending_instagram'
          AND u.portal_role = 'org'
          AND coalesce(u.instagram_user_id, '') <> ''
          AND coalesce(u.instagram_access_token, '') <> ''
        """)
    # Cohort 1, and cohort 3 once it holds the ticket synthesized above: the open
    # 'awaiting_connect' row is their recovery path, so they stay active.
    op.execute("""
        UPDATE users u SET status = 'active'::org_user_status
        WHERE u.status = 'pending_instagram'
          AND u.portal_role = 'org'
          AND EXISTS (
              SELECT 1 FROM org_ig_change_requests r
              JOIN organizations o ON o.id = r.org_id
              WHERE o.user_id = u.id AND r.status = 'awaiting_connect'
          )
        """)
    # Cohort 4 (unbound, no ticket, nothing claimed): there is no handle to bind
    # and no ticket to redeem, so 'active' would close the portal against a
    # credential gate that nothing can satisfy. 'pending_approval' is reachable
    # instead: the admin "send Connect link" action mints a token for an unbound
    # pre-approval org, and approval succeeds once the org connects.
    op.execute("""
        UPDATE users u SET status = 'pending_approval'::org_user_status
        WHERE u.status = 'pending_instagram'
          AND u.portal_role = 'org'
          AND EXISTS (SELECT 1 FROM organizations o WHERE o.user_id = u.id)
        """)
    # Anything left has no organizations row, so no Connect action can reach it
    # whatever its status. Retire the label so none is left writing it.
    op.execute("""
        UPDATE users u SET status = 'active'::org_user_status
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
    # In the old model an owed reconnect was ``pending_instagram``, and
    # ``resend_org_connect``/``bind-start`` only served that status. Every user
    # still holding an ``awaiting_connect`` account-switch ticket here — the
    # switch flagged above and the ticket synthesized above — therefore goes
    # back to ``pending_instagram``, so the old admin resend path reaches them.
    #
    # Deliberately narrowed to ticket holders: an org that was already ``active``
    # and unbound before this migration for an unrelated reason (e.g. a Meta
    # deauthorize clearing its token) keeps its status, exactly as the old code
    # left it. A user with no claimed handle (cohort 4) has no ticket and nothing
    # to reconnect with, so it also stays ``active``.
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
