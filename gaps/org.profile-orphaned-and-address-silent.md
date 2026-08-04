---
id: org.profile-orphaned-and-address-silent
title: Org profile API is orphaned; shipping address never reaches brands
kind: ux_hole
severity: P1
status: open
surface: org
evidence:
  - path: frontend/src/api/hooks
    note: useOrgProfile never imported by any SPA page
  - path: backend/app/services/brands.py
    note: BrandDropDetailApplicant omits delivery_address
repro: |
  Complete onboarding with delivery_address; brand drop detail shows no ship-to; no org profile edit page.
fix_when: |
  Orgs can view/edit profile post-onboarding; brands see delivery_address for accepted/pending applicants.
---

`GET`/`PATCH /api/orgs/me` work, but `useOrgProfile` is never imported by any SPA
page — orgs cannot view/edit profile after onboarding. `delivery_address` is
collected at onboarding and shown on admin org detail, but
`BrandDropDetailApplicant` / brand drop detail omit it, so brands never see where
to ship.
