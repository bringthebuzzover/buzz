---
id: org.awaiting-products-suggestions-no-ui
title: awaiting_products stage has suggestions with no useful org UI
kind: ux_hole
severity: P2
status: deferred
surface: org
evidence:
  - path: frontend/src/pages/org
    note: suggestions timing vs awaiting_products UI gap from audit
repro: |
  Accepted org in awaiting_products; suggestions exist but org cannot usefully act in UI.
fix_when: |
  Org campaign UI matches suggestion availability for early live stages, or suggestions are gated until appropriate.
---

Confirmed in gap audit triage as deferred. Suggestions can exist before the org has a usable selector/action surface.
