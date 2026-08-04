---
id: auth.expired-ig-token-reconnect
title: Expired Instagram token needs org reconnect
kind: ux_hole
severity: P1
status: deferred
surface: auth
evidence:
  - path: backend/app/jobs/token_refresh.py
    note: refresh_due_tokens window is now < expires_at < now+14d; skips already expired
  - path: backend/app/services/instagram_token.py
    note: login raises INSTAGRAM_TOKEN_EXPIRED when remaining <= 0
  - path: frontend/src/api
    note: SPA has no dedicated INSTAGRAM_TOKEN_EXPIRED reconnect branch
repro: |
  ```sql
  SELECT count(*) FROM users
  WHERE portal_role = 'org' AND instagram_token_expires_at <= now();
  ```
fix_when: |
  Org SPA handles INSTAGRAM_TOKEN_EXPIRED with reconnect; cron docs match skip behavior; admin clear-token path remains.
---

`refresh_due_tokens` only selects tokens still valid but within 14 days of expiry
(`now < expires_at < now+14d`). Expired tokens (`expires_at <= now`) are skipped;
Meta also cannot refresh them. Login refresh uses remaining time (not `.days`
truncation) and raises `INSTAGRAM_TOKEN_EXPIRED` when `expires_at <= now`.

The SPA has no dedicated reconnect branch for `INSTAGRAM_TOKEN_EXPIRED` —
`apiFetch` only auto-refreshes and clears the token for code `TOKEN_EXPIRED`,
so it rethrows this one untouched; the bounce to login comes from `fetchMe`,
which treats any 401 as unauthenticated, plus `RequireAuth`.

Admin can clear the token (`POST /api/admin/orgs/{user_id}/clear-instagram-token`)
so the org can reconnect after a hard failure.

```sql
SELECT count(*) FROM users
WHERE portal_role = 'org' AND instagram_token_expires_at <= now();
```
