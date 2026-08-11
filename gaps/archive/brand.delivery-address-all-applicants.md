---
id: brand.delivery-address-all-applicants
title: Brand drop detail returns deliveryAddress for every applicant including denied
kind: authz
severity: P2
status: fixed
closed_in: bcdb6cc
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
  Brand drop-detail API returns deliveryAddress only for applied + accepted;
  denied (and any other non-applied/non-accepted) rows have null; backend
  test asserts denied → null and applied/accepted still get the address.
---

# Brand deliveryAddress overshare

Security audit 2026-08-11 (area 10a). Parent-verified.

**Locked approach (easy / clean):** one API rule — set `delivery_address` from
`org.delivery_address` only when `decision` is `applied` or `accepted`;
otherwise `null`. No frontend privacy special-casing; no new endpoints or
schemas. Selection UI and accepted roster keep Ship to as today.
