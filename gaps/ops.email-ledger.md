---
id: ops.email-ledger
title: Durable email send ledger and remaining honesty paths
kind: silent_loss
severity: P2
status: deferred
surface: ops
evidence:
  - path: gaps/ops.email-best-effort-no-ledger.md
    note: v1 closes false-success/one-shot burns only; explicitly leaves ledger and denial org-visible loss open
  - path: backend/app/services/email.py
    note: _dispatch is best-effort; no email_sends table
repro: |
  After email-honesty v1: denial still has no org-visible channel; invite/reset
  can still report success without delivery; ops cannot query send history.
fix_when: |
  Durable email_sends (or equivalent) records kind/recipient/status/provider id
  or error; ops/admin can distinguish provider accept vs business success.
  Remaining honesty paths from email-honesty OUT list are addressed or
  explicitly wontfix: drop-denial org-visible signal (and/or admin resend),
  brand invite / password-reset false-success, optional Resend webhooks/outbox.
  Business writes still must not roll back solely because mail failed.
---

## Follow-up (required after `email-honesty`)

**Not timeless-complete in v1.** `ops.email-best-effort-no-ledger` / cluster
`email-honesty` deliberately ships cheap wins only. Archiving that gap does
**not** close this follow-up.

### In scope when un-parked

1. **Send ledger** — durable attempt rows (kind, to, status, `resend_id`/error,
   related entity ids) + ops/admin queryability (and/or health failed count).
2. **Drop-application denial org-visible loss** — still PRODUCT email-only with
   no My Campaigns row; v1 only structured-logs. Pick: in-app signal, brand
   finalize `denial_emails_failed`, admin resend, or PRODUCT-accepted silence
   (wontfix with PRODUCT note).
3. **Invite / password-reset honesty** — same bool/ledger treatment as
   verification (out of email-honesty v1).
4. **Optional later:** Resend webhooks, outbox/retry worker (not required to
   start this gap).

### Dependency

Prefer after `email-honesty` lands (`_dispatch` bool already exists). Do not
block notify-cron on this follow-up.
