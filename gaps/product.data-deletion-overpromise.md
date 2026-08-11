---
id: product.data-deletion-overpromise
title: /data-deletion promises 30-day wipe; no delete/purge implementation
kind: ux_hole
severity: P2
status: open
surface: product
evidence:
  - path: frontend/src/pages/legal
    note: data-deletion copy claims email → delete within 30 days (confirm path)
  - path: backend/app/routes/auth.py
    note: IG deauthorize clears token only — keeps user row
repro: |
  Read /data-deletion claims vs repo — no account-deletion API, job, or Meta
  data-deletion callback handler.
fix_when: |
  PRODUCT/legal-aligned path implemented (or page copy matches ops-only
  mailto reality); Meta deletion callback if required.
---

# Data-deletion overpromise

Security audit 2026-08-11 (area 10a). Parent-verified honesty gap — may need
PRODUCT/legal ask before changing copy vs implementing delete.
