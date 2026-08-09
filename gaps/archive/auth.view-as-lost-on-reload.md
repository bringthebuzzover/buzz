---
id: auth.view-as-lost-on-reload
title: Admin View as ends on full page reload (403 on portal URL)
kind: ux_hole
severity: P2
status: fixed
surface: admin
evidence:
  - path: frontend/src/api/auth.ts
    note: Impersonation bearer + impersonating flag are in-memory only
  - path: backend/app/routes/admin.py
    note: POST /impersonate intentionally does not set a refresh cookie
  - path: frontend/src/contexts/AuthContext.tsx
    note: Bootstrap refresh restores admin from buzz_refresh; no View-as resume
  - path: frontend/src/components/routing/RequireRole.tsx
    note: Admin left on /org/* or /brand/* sees inline 403
repro: |
  1. Admin View as an active org → land on /org/browse with ImpersonationBanner.
  2. Hard reload the page.
  3. Session becomes admin again; URL stays /org/browse → RequireRole 403.
fix_when: |
  Same-tab hard reload during View as remints impersonation and keeps the
  portal URL + banner. Exit / TOKEN_EXPIRED Exit / logout clear the latch so
  a later /org visit does not remint. Resume failure (target not active) leaves
  admin on /admin (or equivalent), not a portal 403 dead-end.
---

# Notes

By design today: View as is a short-lived access JWT; admin `buzz_refresh`
untouched so Exit is a client-side drop. That means reload cannot restore View
as without a durable **intent** (sessionStorage latch remint, or httpOnly
intent cookie / refresh claim).

Recommended approach (FE-only, mirrors Instagram reconnect latch):

1. **B1+B2** — `sessionStorage` latch `{ userId, portalRole?, setAt }` set on
   View as; cleared in `clearImpersonationSession` + logout; URL-gated remint
   in AuthContext bootstrap after admin `/me` while still `authenticating`
   (portal paths only; clear latch on `/admin*` without remint); latch TTL.
2. **Light A** — `RequireRole`: authenticated admin on wrong portal → navigate
   `/admin` (resume-failure / mistaken URL fallback).

Alternatives (heavier): httpOnly View-as intent cookie or `imp_target` on
admin refresh JWT — better vs XSS, but Exit is no longer a pure client drop
and needs BE + ARCHITECTURE updates.

Not the thin refresh-200 race; different problem.
