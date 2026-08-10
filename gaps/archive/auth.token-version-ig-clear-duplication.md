---
id: auth.token-version-ig-clear-duplication
title: token_version bump and IG token clear are copy-pasted across services
kind: dead_code
severity: P2
status: fixed
closed_in: pending
surface: auth
evidence:
  - path: backend/app/services/instagram_token.py
    note: clear_unusable_instagram_token already clears ciphertext + optional bump (SOT)
  - path: backend/app/services/auth.py
    note: revoke_instagram_authorization re-implements the same field nulls + bump
  - path: backend/app/services/admin.py
    note: clear_org_instagram_token duplicates clear+bump; deny_org/deny_brand inline bump only
  - path: backend/app/routes/auth.py
    note: logout has two inline bump branches (Bearer then refresh fallback)
  - path: backend/app/services/password_reset.py
    note: reset_password inline bump on consume
  - path: backend/app/services/auth.py
    note: issue_token_pair is the login/refresh bump path (no IG clear)
repro: |
  Grep `token_version = (user.token_version or 0) + 1` and IG field nulls under
  backend/app — multiple independent copies; a future revocation path can miss
  a field or skip the bump.
fix_when: |
  Single bump_token_version(user) helper used by logout, refresh rotate, deny,
  password-reset consume, and IG clear paths. IG ciphertext clears (admin clear,
  Meta deauthorize, undecryptable/expiry) go through clear_unusable_instagram_token
  (or a thin wrapper) so field set + bump stay one SOT. Existing tests for
  revocation / reconnect stay green; no behavior change for clients.
---

## Context (SOT/DRY audit)

Internal DRY debt from the SOT/DRY audit — **not** a user-visible bug today.
Parked so agents do not auto-execute; un-park only when named explicitly.

### Locked v1 (when un-parked)

1. Add `bump_token_version(user: User) -> int` (e.g. in `app/services/auth.py` or
   a tiny `app/security/session.py`) that does
   `user.token_version = (user.token_version or 0) + 1` and returns the new ver.
2. Replace every inline bump under `backend/app` (routes + services) with that
   helper — tests may keep literals.
3. Route `revoke_instagram_authorization` and `clear_org_instagram_token` through
   `clear_unusable_instagram_token` (already supports `bump_session`) instead of
   re-nulling the four IG columns + bump by hand.
4. Non-goals: no JWT claim changes; no new admin UX; no OpenAPI change.

### Out

- Email DEV console DRY, schema validator DRY, OpenAPI typed responses (separate
  gaps / not tracked).
- Intentional stage-list splits (metric vs autolink mint).
- Metric-sync clock-expired skip-without-clear asymmetry (related auth/IG
  behavior; not this DRY gap).

---

## Inventory (verified)

Two duplication shapes. Field set for every IG clear is identical: null
`instagram_access_token`, `instagram_token_issued_at`, `instagram_token_expires_at`,
`instagram_token_refreshed_at`. Never clears `instagram_user_id` /
`instagram_token_user_id` / `instagram_username`. `bump_session=False` is unused.

### A. Shared SOT — `clear_unusable_instagram_token` (clear + bump)

| Caller | Trigger | Entry |
| --- | --- | --- |
| `maybe_refresh_on_login` | undecryptable | `get_current_user` (skipped under impersonation); dual clear: dedicated session + in-memory |
| `maybe_refresh_on_login` | clock-expired | same |
| `refresh_instagram_token` | decrypt fail | bg task from near-expiry login check |
| `jobs/token_refresh.py` | decrypt fail | cron `token_refresh` |
| `jobs/metric_sync.py` `_token_for` | decrypt fail | cron `metric_sync` (clock-expired: skip only, no clear) |

### B. Hand duplicates — same four nulls + bump (route through A)

| Function | File | Entry |
| --- | --- | --- |
| `revoke_instagram_authorization` | `services/auth.py` | `POST /api/auth/instagram/deauthorize` (lookup by Meta IG id) |
| `clear_org_instagram_token` | `services/admin.py` | `POST /api/admin/orgs/{user_id}/clear-instagram-token` |

### C. Inline bump only — replace with `bump_token_version`

| Site | File | Entry / callers |
| --- | --- | --- |
| `issue_token_pair` | `services/auth.py` | IG callback, refresh, brand login/set-password, admin login, dev-login |
| `logout` Bearer branch | `routes/auth.py` | `POST /api/auth/logout` |
| `logout` refresh fallback | `routes/auth.py` | same |
| `deny_org` | `services/admin.py` | admin deny org |
| `deny_brand` | `services/admin.py` | admin deny brand |
| `reset_password` | `services/password_reset.py` | brand + admin reset-password |

### Does not bump (leave alone)

`undeny_*`, approve paths, `mint_impersonation_token` (stamps current `ver` only).

### Reads `ver` (consumers, not writers)

`deps/auth.py` `_load_user_from_bearer`; `routes/auth.py` `refresh`.
