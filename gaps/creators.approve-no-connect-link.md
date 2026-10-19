---
id: creators.approve-no-connect-link
title: Approving a creator does not send a connect link or session
kind: ux_hole
severity: P1
status: open
surface: auth
evidence:
  - path: backend/app/services/creators.py
    note: approve_creator only sets creators.status to pending_instagram
  - path: backend/app/services/admin.py
    note: approve_org mints OrgConnectToken and emails the one-shot connect URL
repro: |
  POST /api/creators/apply, confirm the verify token, then
  POST /api/admin/creators/{id}/approve as an admin.
  Response status is pending_instagram and there is no access token.
  POST /api/auth/instagram/bind-start without a Bearer returns 401.
  No creator connect email is sent.
fix_when: |
  Approve emails a one-shot link that opens a creator session on
  /creators/connect, and bind-start works from that session. The link is
  single-use. An org approval still uses the org connect email.
---

# Creator approve stops before a session

Instagram bind requires a logged-in creator whose status is `pending_instagram`. Approval never mints that session or sends mail, so the creator cannot click Connect Instagram. Organizations already get this from the approval email.
