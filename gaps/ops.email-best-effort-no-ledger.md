---
id: ops.email-best-effort-no-ledger
title: Email delivery is best-effort with no ledger
kind: silent_loss
severity: P2
status: open
surface: jobs
evidence:
  - path: backend/app/services/email.py
    note: _dispatch swallows failures; no ledger or Resend webhook
repro: |
  Misconfigure Resend; deny applicant; API succeeds; no email and no durable send record.
fix_when: |
  Failed sends are observable (ledger and/or webhook) without rolling back business writes incorrectly.
---

`_dispatch` in `backend/app/services/email.py` swallows every failure by design so a
bad address cannot roll back the operation that triggered it. Successful sends log
the Resend message id (`resend_id=…`), but there is still no email ledger table, no
per-send delivery status, and no Resend webhook endpoint — so a failed Buzz send
remains indistinguishable from success at the API layer. (`notify_me.sent_at` only
records that the reminder job *attempted* a send; it is not a delivery receipt.)

This is sharpest for `send_application_denied_email`: denied applicants get no
My Campaigns row (`campaigns.py` filters them out and 404s on detail), so the email
is the only channel they ever hear back on.

Also: `resend_verification_email` mints a new token before `_dispatch`. With Resend
down/misconfigured, three failed "re-sents" still consume the max-3 live-token
cap and the fourth returns 429 until the oldest expires (~24h), while the UI claims
the email was re-sent.
