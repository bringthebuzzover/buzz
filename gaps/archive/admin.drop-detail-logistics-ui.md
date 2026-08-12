---
id: admin.drop-detail-logistics-ui
title: Admin drop detail logistics editor is flush, jargon-y, and missing ship-to
kind: ux_hole
severity: P2
status: fixed
closed_in: 973944c
surface: admin
evidence:
  - path: frontend/src/pages/admin/AdminDropDetailPage.tsx
    note: DropConfigEditors has border-t but no px-4; labels are plain text-sm; checkbox says "Clear to spot-only (send null)"; datetime-local seeded via toISOString slice (UTC); applicants table shows redundant drop-level trackingNumber, never deliveryAddress
  - path: frontend/src/components/admin/AdminPrimitives.tsx
    note: FieldGrid is px-4 py-4 — logistics editor must match
  - path: frontend/src/pages/admin/AdminBrandsPage.tsx
    note: Invite brand form = label dialect SOT (uppercase faint xs + px-4 py-4)
  - path: frontend/src/components/brand/ApiDropOrgTable.tsx
    note: Brand "Ship to:" pattern for deliveryAddress
  - path: backend/app/services/admin_read.py
    note: get_drop_detail already returns delivery_address; tracking_number per applicant is the drop-level TN
  - path: gaps/brand.delivery-address-all-applicants.md
    note: Brand privacy contracts address to applied+accepted; admin FE should mirror display rule
  - path: PRODUCT.md
    note: §5.2.1 MVP = admins enter TN manually; no EasyPost required
repro: |
  Open /admin/drops/:id. Configuration → Edit logistics is flush to panel
  edges vs FieldGrid above. Unit-budget clear copy says "(send null)".
  Applicants tab: Tracking column repeats drop TN; no Ship to / address.
  Load a drop whose applyOpenAt local time ≠ UTC; datetime-local shows
  UTC wall time (toISOString slice).
fix_when: |
  On /admin/drops/:dropId Configuration → Edit logistics:
  (1) Horizontal padding matches FieldGrid / TrackerControls (px-4; bottom
      padding consistent with sibling panels).
  (2) Field labels use the admin form dialect (uppercase faint xs labels),
      not plain text-sm font-medium.
  (3) No API jargon in user-visible copy ("send null" gone; clear =
      spot-only / clear hashtag in plain language).
  (4) datetime-local inputs show and save wall-clock times in the admin's
      local timezone (no UTC shift from toISOString seed).
  (5) Applicants table: no per-row Tracking column; drop TN remains on
      Configuration Field + Tracker only.
  (6) Applicants table shows Ship to for applied + accepted (address or
      "Not set"); denied and other decisions show "—" (FE gate; do not
      wait on brand.delivery-address-all-applicants).
  Visual language matches existing admin Panel/Field/TrackerControls —
  not a marketing redesign. Tests for local datetime helper and/or
  applicants column rules. FE-only (no backend/OpenAPI unless types missing).
---

# Admin drop detail — logistics UI polish

## Problem

Admin individual drop view logistics editor is ops-critical and currently
ugly/inconsistent: flush to the panel edge, mismatched labels vs Tracker /
Invite Brand, API jargon on clear-units, UTC-skewed apply window inputs,
and an applicants table that duplicates drop-level tracking while hiding
the ship-to address the API already returns.

## Locked v1 scope

### In (must)

| Item | Lock |
| ---- | ---- |
| Margins / padding | Wrap `DropConfigEditors` body with same inset as `FieldGrid` / `TrackerControls` (`px-4` + bottom padding). Keep `border-t` separator under Configuration read-only grid. |
| Labels | Match TrackerControls / InviteBrandForm: `text-xs font-bold uppercase tracking-wide text-buzz-inkFaint` on field captions. |
| Copy | Replace "Clear to spot-only (send null)" → **"Clear to spot-only"**. Soften unit placeholder to human ops language (no "null"). Leave "Clear hashtag" as-is. |
| datetime-local TZ | **In this gap.** Seed apply open/close with a local `YYYY-MM-DDTHH:mm` helper (not `toISOString().slice`). Keep save via `new Date(value).getTime()` (local parse). |
| Applicants Tracking column | **Remove.** Drop-level TN already lives in Configuration `Field` + Tracker. |
| Applicants Ship to | **Add column** (replace Tracking). Show for `decision === "applied" \|\| "accepted"` only — address string, or "Not set" when null (mirror brand). Other decisions → "—". FE gate only; no admin API change. |

### Out (non-goals)

- EasyPost / carrier webhooks / label purchase (PRODUCT §5.2.1 Future)
- PRODUCT redesign of who owns logistics
- Backend nulling of admin `deliveryAddress` by decision
- Fixing `brand.delivery-address-all-applicants` (separate cluster)
- TrackerControls layout/copy redesign
- Timeline / attribution tabs, capacity math, stage machine
- Marketing / landing-style visual redesign

### Confirmed 2026-08-11 (handoff)

- Keep admin MVP logistics entry (no ownership redesign).
- No EasyPost / multi-package TN in this change.
- `brand.delivery-address-all-applicants` is **done** — FE Ship-to gate
  (applied+accepted) is enough; do not block on brand API work.

### stop_if

- Admin applicants omit `deliveryAddress` in a deployed contract (schema
  currently includes it) — verify then ask.

## File touch list (FE-only)

| File | Change |
| ---- | ------ |
| `frontend/src/pages/admin/AdminDropDetailPage.tsx` | Padding, labels, copy, local datetime seed, applicants headers/cells |
| `frontend/src/components/admin/labels.ts` | Optional shared `toDatetimeLocalValue(ms)` helper |
| Tests | Local datetime round-trip and/or applicants column visibility rules |

No backend, no `openapi.json`, no PRODUCT edit.
