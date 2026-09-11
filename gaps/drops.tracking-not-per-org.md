---
id: drops.tracking-not-per-org
title: Tracking is one number per drop; ops ships many TNs per org–drop
kind: ux_hole
severity: P2
status: open
surface: drops
evidence:
  - path: PRODUCT.md
    note: §3.1.1 SOT is drops.tracking_number, one TN per drop; §5.2.1 MVP = admin manual entry, no carrier API; §6.4.1 org Accepted shows that same number
  - path: backend/app/models/drop.py
    note: Drop.tracking_number is a single nullable String(255)
  - path: backend/app/models/application.py
    note: DropApplication has no shipment/tracking columns; comment says tracking lives on the drop
  - path: backend/migrations/versions/f1a2b3c4d5e6_drop_denormalized_sot_columns.py
    note: Explicitly moved drop_applications.tracking_number onto drops (one TN per campaign)
  - path: backend/app/services/admin.py
    note: set_drop_tracking_number / advance to awaiting_products writes one string on the drop
  - path: frontend/src/pages/admin/AdminDropDetailPage.tsx
    note: One tracking input on tracker advance; applicants table does not edit per-org TNs
  - path: frontend/src/pages/org/OrgCampaignDetailPage.tsx
    note: Org sees detail.trackingNumber from the drop, not from their seat
  - path: frontend/src/components/brand/BrandDropTrackerStepper.tsx
    note: Brand tracker shows the same single drop-level number
---

# Tracking not per org–drop (multi-package)

## Why this is needed

Fulfillment is **per accepted organization on a drop**, not one carton for the
whole campaign. A typical seeded-launch wave looks like:

- Cornell Kappa Alpha Theta — 12 cases, **6** FedEx numbers
- Cornell Epsilon Nu Tau — 9 cases, **5** UPS numbers (two shipper accounts)
- Miami Zeta Tau Alpha — 15 cases, **mixed UPS + FedEx**
- Alabama Gamma Phi Beta — 15 cases, **8** FedEx numbers
- Case Western Alpha Gamma Delta — 9 cases, **mixed**

Case count ≠ tracking count (several cases per carton, incomplete paste, or
multi-piece). Carriers differ **within one drop** and sometimes **within one
org**. Ops currently keep that list in chat/spreadsheets. The product cannot
store it, so orgs/brands either see **nothing useful** or the **wrong shared
number**.

## What we support today

| Capability | Today |
| ---------- | ----- |
| Org ship-to address | Yes — `organizations.shipping_*` (one address per org, not per drop) |
| Tracking numbers | **0 or 1** string on `drops.tracking_number` |
| Scope | **Whole drop** — every org/brand/admin surface joins that column |
| Carrier / service | Not stored; not inferred |
| Deep links to UPS/FedEx | None |
| Live scan status / EasyPost | None (PRODUCT §5.2.1 Future; LAUNCH parked) |
| Who enters it | Admin only, typically required when advancing to **Awaiting Products** |
| Who cannot enter it | Brand and org |

Org **Accepted** and brand **Awaiting Products** copy assume a singular
“tracking number shown when available.” PRODUCT §12 still TBD whether that
number surfaces in both places at once — implementation already shows the
**same** drop-level field on both.

## What needs to be supported

For each **org–drop pair** (`drop_applications` seat, typically `accepted`):

- A **set** of tracking numbers: **none, one, or many**
- Each item: the raw number plus **which service it is arriving on** (at least
  UPS vs FedEx; UPS Ground is readable from `1Z` service `03`)
- Org (and likely brand/admin) can **open a carrier track URL** per number
- Empty set is valid (not yet shipped)

**Not in this gap’s v1:** purchasing labels, rate shopping, EasyPost/AfterShip
webhooks, in-app “out for delivery” timelines. Links + stored carrier beat
spreadsheets. Live status can stay §5.2.1 Future.

## Broken path (as-built vs ops)

1. Admin can only attach **one** TN to the **campaign**.
2. That TN is shown to **every** participating org.
3. Mixed-carrier, multi-carton, per-chapter shipments **cannot be represented**.
4. Applicants UI previously even **repeated** the drop TN per row (logistics UI
   gap removed that column) — there is still no per-org list to put in its
   place.

## Likely shape (not locked — PRODUCT fork)

Natural SOT: child rows on the **application** (org × drop), e.g.
`drop_application_shipments` (`tracking_number`, `carrier`, optional
`service`, uniqueness on `(application_id, tracking_number)`). Infer carrier
from `1Z…` vs 12-digit FedEx; allow ops override. Public links:

- UPS: `https://www.ups.com/track?tracknum={id}`
- FedEx: `https://www.fedex.com/fedextrack/?trknbr={id}`

`drops.tracking_number` would need a retirement or “any shipment exists”
derivation so tracker advance rules stay honest.

## PRODUCT fork (do not implement until asked)

This **reverses** §3.1.1 (“one TN per drop”) and the denormalizing migration.
It also changes §5.2 / §6.4 singular copy and admin tracker validation
(one required string to awaiting_products).

Open decisions to lock in PRODUCT before coding:

1. Tracking is **per accepted seat**, 0–N numbers, not one per campaign.
2. Visibility: org only vs org + brand vs admin-edit / others read.
3. Brand tracker when orgs have different carriers and counts.
4. v1 = stored numbers + carrier + outbound links (this gap) vs live API
   status (stay Future).

## Repro

```
Admin: publish drop, accept two orgs, advance to awaiting_products with
  tracking_number "1Z3V817W0392590700".
Org A and Org B campaign detail both show that same UPS number.
There is no API to attach FedEx 876654644443 to Org A only, or a second
UPS number to Org B.
GET brand drop detail / GET org campaign: single trackingNumber field.
```

## fix_when

PRODUCT updated: SOT is 0–N tracking numbers **per org–drop application**,
with carrier/service. Admin can CRUD that set (empty allowed). Org (and
whoever PRODUCT names) sees the list with carrier label and a working
track link per number — not one shared `drops.tracking_number`. Brand
tracker no longer implies a single campaign carton unless PRODUCT says
so. Tests cover 0/1/N and mixed UPS+FedEx on one seat. EasyPost/live
webhooks are **not** required to archive this file.
