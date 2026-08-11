---
id: brand.delivery-address-all-applicants
title: Brand drop detail returns deliveryAddress for every applicant including denied
kind: authz
severity: P2
status: open
surface: brand
evidence:
  - path: backend/app/routes/brands.py
    note: delivery_address=org.delivery_address with no decision gate
  - path: frontend/src/components/brand/ApiDropOrgTable.tsx
    note: Post-finalize UI filters accepted; API still returns denied rows with address
  - path: gaps/archive/org.profile-orphaned-and-address-silent.md
    note: fix_when mentioned accepted/pending — denied never contracted
repro: |
  Brand drop with accepted + denied applicants.
  GET /api/brands/me/drops/{id} → denied row still has deliveryAddress.
fix_when: |
  PRODUCT-locked least privilege (e.g. address only for accepted, or
  accepted+applied); API omits/nulls address for denied (and tests assert);
  privacy copy updated if sharing scope changes.
---

# Brand deliveryAddress overshare

Security audit 2026-08-11 (area 10a). Parent-verified. May need PRODUCT ask on
exact decision matrix before coding.
