---
id: brand.ig-handle-no-change-path
title: Brands have no path to change Instagram handle after apply
kind: ux_hole
severity: P3
status: open
surface: brand
evidence:
  - path: backend/app/schemas/brands.py
    note: Brand apply collects instagram_handle once; no brand-profile PATCH for it
  - path: frontend/src/pages/admin/AdminBrandDetailPage.tsx
    note: Admin brand Instagram field is read-only display
  - path: PRODUCT.md
    note: §3.1.1 brand handle is autolink caption-matching text, not login identity
repro: |
  Approved brand with handle @oldbrand. Autolink matches that @ in captions.
  There is no brand portal settings page and no admin edit for brands.instagram_handle.
fix_when: |
  PRODUCT names a cheap path (admin edit or request) that updates
  brands.instagram_handle without Graph re-bind. Existing post_campaign_links
  stay. Future autolink uses the new @. Do not put this on the org OAuth path
  (org.ig-identity-change-no-path / PRODUCT §3.1.4).
---

# Brand Instagram handle has no change path

Org Instagram identity is Graph-id login (**§3.1.4**). Brand `@` is only
autolink caption text. Changing it does not move posts or tokens.

This is a living hole: a rebrand or typo at apply permanently poisons
caption matching. Cheaper than org switch — no re-bind latch. Do not
implement on the org request/OAuth machinery.
