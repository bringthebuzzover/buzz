---
id: org.apply-handle-unique-race
title: Concurrent org apply can claim the same Instagram handle
kind: invariant_break
severity: P2
status: fixed
surface: org
evidence:
  - path: backend/app/models/user.py
    note: partial unique index uq_users_org_instagram_username_lower
  - path: backend/migrations/versions/f7a8b9c0d1e2_users_org_instagram_username_lower.py
    note: Alembic revision; IF NOT EXISTS after autocommit enum commit
  - path: backend/app/services/org_apply.py
    note: IntegrityError on user flush maps to INSTAGRAM_HANDLE_TAKEN
  - path: backend/tests/test_constraints.py
    note: case-insensitive unique; erased rows excluded
repro: |
  Two concurrent POST /api/orgs/apply with the same instagramHandle. Both pass
  assert_handle_available before either commits. Two pending_email_verification
  orgs share the handle. Sequential duplicate test (test_org_apply.py) does not
  cover the race. Erased-user handle reuse is intentional and must survive the
  unique index (partial / nullable).
fix_when: |
  DB uniqueness on claimed handle among non-erased orgs (partial unique index
  on lower(instagram_username) or equivalent). Concurrent apply maps
  IntegrityError to INSTAGRAM_HANDLE_TAKEN (409). Erased rows can still free
  the handle. Tests cover sequential + constraint (or concurrent) duplicate.
---

# Apply-time handle uniqueness is check-then-insert

**Shipped:** partial unique index on `lower(instagram_username)` for non-erased
orgs; apply IntegrityError on the **user** flush → 409
`INSTAGRAM_HANDLE_TAKEN`; erased rows stay out of the index. `closed_in` at
commit.
