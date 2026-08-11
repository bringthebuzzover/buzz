---
id: product.data-deletion-overpromise
title: /data-deletion promises 30-day wipe; no delete/purge implementation
kind: ux_hole
severity: P2
status: fixed
surface: product
evidence:
  - path: frontend/src/pages/legal/DataDeletionPage.tsx
    note: mailto + honest inventory (identity wipe; KPIs may remain anonymized)
  - path: backend/app/services/admin_erase.py
    note: admin org hybrid erase
  - path: META.md
    note: Meta Hosts use instructions URL path — deletion callback not required
repro: |
  Read /data-deletion claims vs repo — historically no account-deletion path;
  admin erase + honest copy close the gap.
fix_when: |
  Admin org hybrid erase shipped (IG-handle confirm; identity scrub; KPIs
  retained per PRODUCT §4.3/§3.1.2; confirmation email when address on file);
  /data-deletion copy matches (no firm 30-day full wipe; metrics may remain
  anonymized); no Meta data-deletion callback; no brand erase in v1; tests +
  ci-local green.
---

# Data-deletion overpromise

Security audit 2026-08-11 (area 10a).

**Shipped (hybrid erase):** admin org Erase from org detail (confirm Instagram
handle); scrub identity/PII and identifiable post content; **keep**
posts/links/metrics/follower_count/university/accepted seats; confirmation
email to `users.edu_email` when present; legal page + PRODUCT aligned. Meta
instructions URL kept. No brand erase / no Meta deletion callback in v1.
