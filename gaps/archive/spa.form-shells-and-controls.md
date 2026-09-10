---
id: spa.form-shells-and-controls
title: Form shells and native controls are copy-paste, not primitives
kind: ux_hole
severity: P2
status: fixed
surface: spa
evidence:
  - path: frontend/src/pages/auth/BrandLoginPage.tsx
    note: Short brand login uses py-16 stack; org login is flex-centered
  - path: frontend/src/pages/admin/AdminDropDetailPage.tsx
    note: Native checkboxes, datetime-local, nested labels, tracker select
  - path: frontend/src/pages/org/OrgDropFeedPage.tsx
    note: lg 3-col grid orphans a single card to the left
  - path: frontend/src/pages/brand/BrandRequestDropPage.tsx
    note: Submit sits outside the bordered card; coral h2 vs portal ink titles
repro: |
  Open /login vs /brand/login — short brand form sits high with empty cream.
  Open /org/browse with one drop — card hugs the left of a 3-col grid.
  Open admin drop Config — OS checkboxes and datetime-local next to Buzz fields.
fix_when: |
  Shared AuthShell (center vs stack), PageShell widths, and form primitives
  (TextField, Select, Checkbox, Button, ErrorBanner) live under frontend/src.
  Atlas fail rows are migrated: short auth centered, org apply stack + Select,
  admin drop/hide/tester/invite controls, org feed single-card layout, brand
  request CTA in the card. Leftover hunter frontend/scripts/check-ui-primitives.sh
  is green. Visual rubric pass on fail rows. No Paper/home restyle.
---

Shipped fit-finish: `AuthShell` / `PageShell`, form primitives, leftover hunter in
`ci-local`. Skill: [`.agents/skills/ui-fit-finish/SKILL.md`](../../.agents/skills/ui-fit-finish/SKILL.md).
`closed_in` pending commit.
