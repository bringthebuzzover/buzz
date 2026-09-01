---
id: brand.drop-creative-uneditable
title: Owning brand cannot edit drop title, description, or picture after create
kind: ux_hole
severity: P2
status: fixed
surface: brand
evidence:
  - path: backend/app/routes/brands.py
    note: PATCH /api/brands/me/drops/{id} creative when brand_can_edit_creative
  - path: backend/app/services/admin.py
    note: Admin creative PATCH allowed after publish
  - path: frontend/src/pages/admin/AdminDropDetailPage.tsx
    note: Config tab + brand-can-edit-creative checkbox
  - path: frontend/src/pages/brand/BrandDropDetailPage.tsx
    note: Campaign card when flag on
  - path: PRODUCT.md
    note: §5.2 brand creative only when admin enables the flag
repro: |
  Fixed — see tests/test_brand_drop_creative.py and e2e admin publish+config save.
fix_when: |
  Shipped. Set closed_in at commit.
---

# Brand drop creative (admin always; brand opt-in)

Shipped cluster `brand-drop-creative`. Admin always edits title/description/image/location.
Brand edits title/description/image only when `brand_can_edit_creative` is true (default false).

## Residual (out of this gap)

Blob upload, public `/hero`, org notify on creative change, brand logistics.
