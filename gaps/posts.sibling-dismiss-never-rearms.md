---
id: posts.sibling-dismiss-never-rearms
title: Sibling dismiss never rearms suggestions
kind: invariant_break
severity: P2
status: wontfix
surface: org
evidence:
  - path: backend/app/services/posts.py
    note: sibling dismiss behavior accepted as product in audit triage
repro: |
  Dismiss suggestion; sibling paths do not re-arm; product accepts.
fix_when: |
  N/A — wontfix unless PRODUCT changes. Delete only if product decision reverses and code changes.
---

Audit triage: wontfix / product accept. Kept on disk so the decision remains visible.
