---
id: spa.creator-gate-ignores-session
title: Creator pages follow the mock session instead of the signed-in user
kind: ux_hole
severity: P1
status: open
surface: spa
evidence:
  - path: frontend/src/pages/creator/CreatorStatusGate.tsx
    note: allow-list uses useCreatorSession from the in-memory store
  - path: frontend/src/api/hooks/creator/useCreatorHooks.ts
    note: session status comes from mockCreatorStore, not /api/creators/me
  - path: frontend/src/utils/landing.ts
    note: a real creator JWT already lands on /creators/feed
repro: |
  Sign in as a creator (Instagram callback, portal_role creator).
  Open /creators/feed. The gate reads the mock viewer, which is empty, and
  sends the signed-in creator to apply. The same mismatch happens after
  POST /api/creators/verify-email redirects to /creators/pending.
fix_when: |
  Creator route gates use the authenticated creator status from the API.
  Apply still redirects a new applicant to verify. A denied creator stays off
  the feed. The admin demo can keep its sample session without overriding a
  real creator login.
---

# Creator gate and the API disagree

`pathForUser` sends a creator JWT to `/creators/feed`. The page gate then ignores that session and uses the preview store, so verification and OAuth do not land on the step the API just set.
