---
id: spa.native-confirm-dialogs
title: Admin erase and brand finalize used native browser prompt/confirm
kind: ux_hole
severity: P2
status: fixed
surface: spa
evidence:
  - path: frontend/src/pages/admin/AdminOrgDetailPage.tsx
    note: Erase used window.prompt (browser chrome, not Buzz type-to-confirm)
  - path: frontend/src/pages/brand/BrandDropDetailPage.tsx
    note: Finalize used window.confirm
fix_when: |
  No window.prompt / window.confirm / window.alert in frontend/src. Admin org
  erase types the Instagram handle in an in-app panel (same family as hide
  campaign). Brand finalize uses an in-app confirm with accept/deny counts.
  Leftover hunter bans native dialogs.
---

PRODUCT still requires typing the Instagram handle for erase (§3.1.2); only the
chrome changed. `closed_in` pending commit.
