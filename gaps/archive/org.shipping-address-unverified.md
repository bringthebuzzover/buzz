---
id: org.shipping-address-unverified
title: Org shipping address is free text, not a verifiable mailing address
kind: ux_hole
severity: P2
status: fixed
surface: org
evidence:
  - path: frontend/src/pages/onboarding/OrgProfilePage.tsx
    note: Shipping address is a required textarea; no autocomplete or structure
  - path: frontend/src/pages/org/OrgPortalProfilePage.tsx
    note: Same free-text control on post-onboarding profile edit
  - path: backend/app/schemas/onboarding.py
    note: delivery_address validator is strip + non-empty only
  - path: backend/app/schemas/orgs.py
    note: PATCH OrgProfileUpdate same — reject blank, accept any non-empty string
  - path: backend/app/models/organization.py
    note: delivery_address is unconstrained Text; city/state are separate free-text columns
  - path: backend/app/schemas/brands.py
    note: BrandDropDetailApplicant exposes delivery_address blob only (no city/state/zip)
  - path: frontend/src/pages/brand/BrandDropDetailPage.tsx
    note: Brands print Ship to from that blob and ship product from it
  - path: PRODUCT.md
    note: §3.1/§6.1 require shipping address; §5.2.1 Future EasyPost is labels/tracking, not address verify
repro: |
  Org onboarding or PATCH /api/orgs/me with deliveryAddress="asdf" (or "1 Main"
  as in backend/tests/test_onboarding.py). 200. Brand drop detail for an
  applied/accepted applicant shows Ship to: asdf. City/state can disagree
  with the textarea; brands never see city/state on the applicant row.
fix_when: |
  Onboarding + org profile collect a structured, provider-verified US mailing
  address (street, city, state, ZIP at minimum) that brands/admin can use to
  ship. Garbage strings are rejected. Legacy rows have an explicit backfill or
  re-verify path. PRODUCT §3.1/§6.1 updated to the locked field set. Do not
  implement until a Locked v1 picks verifier + city/state collapse (see body).
---

# Org shipping address is not verifiable

**Shipped:** Google Places Autocomplete (New) + Address Validation on the
server (`GOOGLE_ADDRESS_API_KEY`). Apply/onboarding/PATCH take structured US
fields; garbage is `INVALID_SHIPPING_ADDRESS`. Campus city/state stay distinct.
Legacy `delivery_address` blobs remain until the next shipping save. Development
without a key uses format fallback. Production verify needs the Railway **api**
var (not set in this change).

Brands ship campaign product using `organizations.delivery_address`. That field
is a required free-text blob. The API and SPA only check non-empty. City and
state are collected separately and are also free text; they are **not** shown
on brand applicant rows (`BrandDropDetailApplicant` has `delivery_address`
only).

`.edu` is actually verified. Shipping address is labeled as if it were a
deliverable location and is not.

## Why it matters today

This is not a PRODUCT Later idea. The field is required on create and later
edits, exposed to brands for applied/accepted applicants
(`brand.delivery-address-all-applicants` already gated who sees it), and
copied into admin Ship to. A chapter house, dorm, or PO box that cannot be
found is a fulfillment miss, not a polish item.

Related (already fixed, different hole):
[`org.profile-orphaned-and-address-silent`](org.profile-orphaned-and-address-silent.md)
got the address onto brand/admin surfaces. This gap is that the value itself
is not a mailing address.

PRODUCT §5.2.1 Future EasyPost covers labels, tracking, and carrier events —
not verifying the org's ship-to. Address verify is a precursor if labels ever
get generated from this profile.

## Locked v1 (implemented)

1. **Verifier** — Google Places Autocomplete (New) + Address Validation
   (server-side key). Dev empty key → structured US + ZIP fallback.
2. **City / state** — campus `city`/`state` stay distinct from ship-to.
3. **Legacy** — leave old `delivery_address` blobs until the org next saves
   shipping fields. Apply/create always uses the new shape.
4. **Campus mail** — US-only, including PO Boxes and dorm/CPO as street2.
