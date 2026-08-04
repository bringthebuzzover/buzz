---
id: auth.denied-org-loses-denial-ui
title: Denied org loses the denial UI once the access token dies
kind: ux_hole
severity: P2
status: open
surface: org
evidence:
  - path: frontend/src/pages/onboarding
    note: /onboarding/denied is behind RequireAuth
repro: |
  Deny org; wait for access TTL / failed refresh; Instagram callback shows generic failure not denial page.
fix_when: |
  Denied orgs can reach a stable denial screen without a live session, or callback routes them there explicitly.
---

`/onboarding/denied` is behind `RequireAuth`. After access TTL (or a failed
refresh), Instagram callback returns 403 “not permitted” and the SPA shows a
generic failure — never the denial page. (Admin un-deny exists; this is the
post-deny UX hole for the org themselves.)
