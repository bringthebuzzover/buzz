---
id: product.data-deletion-overpromise
title: /data-deletion promises 30-day wipe; no delete/purge implementation
kind: ux_hole
severity: P2
status: open
surface: product
evidence:
  - path: frontend/src/pages/legal/DataDeletionPage.tsx
    note: mailto flow + firm 30-day wipe inventory
  - path: backend/app/routes/auth.py
    note: IG deauthorize clears token only — keeps user row (by design)
  - path: META.md
    note: Meta Hosts use instructions URL path — deletion callback not required
repro: |
  Read /data-deletion claims vs repo — no account-deletion API, job, or Meta
  data-deletion callback handler.
fix_when: |
  /data-deletion copy matches mailto/ops reality (no firm 30-day wipe inventory);
  still documents request + contact + deauthorize-without-delete; no purge API,
  admin delete, job, or Meta data-deletion callback added.
---

# Data-deletion overpromise

Security audit 2026-08-11 (area 10a). Parent-verified.

Page correctly describes a **manual mailto** process (not automated wipe). Meta
instructions URL + deauthorize callback is intentional and valid. The honesty
gap is the firm **30-day** completion + specific wipe inventory with no
engineered fulfillment path.

**Locked approach (easy / clean):** copy-only honesty — soften/remove the firm
30-day wipe inventory; say requests are processed manually and data is removed
or anonymized where required, with legal retention called out. Keep mailto +
Meta instructions URL. Do **not** add purge APIs, admin delete-user, jobs, or a
Meta data-deletion callback.
