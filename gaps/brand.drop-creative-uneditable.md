---
id: brand.drop-creative-uneditable
title: Owning brand cannot edit drop title, description, or picture after create
kind: ux_hole
severity: P2
status: open
surface: brand
evidence:
  - path: backend/app/routes/brands.py
    note: Brand writes are drop-requests + finalize; no PATCH for owned drop title/description/image
  - path: backend/app/schemas/drops.py
    note: No brand creative patch schema; admin AdminDropConfigPatch covers draft creative
  - path: frontend/src/pages/brand/BrandRequestDropPage.tsx
    note: Plan your Campaign posts a ticket (message/notes), not drop creative
  - path: frontend/src/pages/brand/BrandDropDetailPage.tsx
    note: Header renders title+description read-only after admin mint/Publish
  - path: backend/app/schemas/admin.py
    note: Creative PATCH is admin + draft-only (409 after published_at)
  - path: backend/app/models/drop.py
    note: title String(255), description Text, image String(1024) NOT NULL — URL column, no blob
  - path: PRODUCT.md
    note: §5.2 brand sees a read-only tracker; does not get a creative editor in this revamp
repro: |
  1. Brand POST /api/brands/me/drop-requests {message}. 200. No drops row.
  2. Admin creates unpublished drop + Publish. Brand GET drop detail.
  3. PATCH /api/brands/me/drops/{id} → 405. No brand creative write exists.
  4. Open /brand/drops/:id — title and description are static text; no edit,
     no picture control.
fix_when: |
  **Deferred Want** — do not implement during [`LAUNCH.md`](../LAUNCH.md) Phase B.
  Admin writes creative at mint/Publish; brand does not edit creative in this revamp
  (PRODUCT §5.2; LAUNCH §2 Brand/drops). Re-open this gap only after launch-admin-drops
  is archived if brand typo-fix on published drops is still wanted.

  When implemented (post-revamp), owning brand can change title, description, and picture
  on an existing drop they own. Logistics stay admin-only. Tests cover authz, validation,
  and SPA editor. Spec below is the prior Locked v1 — not current launch scope.
---

# Brand cannot edit drop creative after create

**Not in seeded-launch scope.** [`LAUNCH.md`](../LAUNCH.md) §2 locks **admin** creative on
draft/Publish; brand monitor is read-only. This gap is a **Want after** Phase B
(`LAUNCH.md` §3 “After this revamp”). Do not ship brand `PATCH` creative while
implementing `launch-admin-drops`.

`brand.drop-create-thin` shipped **admin** logistics PATCH. Admin later gained
draft creative PATCH (Phase B). There is still **no brand write** for title /
description / image after admin mint. Tickets are not creative.

PRODUCT §5.1–§5.2 keeps **logistics** with Buzz (capacity, window, units,
hashtag, tracker). Brand typo-fix on published creative remains a Want.

## Deferred Want v1 (post-revamp only — not Phase B)

### Fields (brand-owned only)

| Field | v1 | Clearable? | Notes |
| --- | --- | --- | --- |
| `title` | **IN** | no | strip; non-blank; max 255; explicit `null` → **422** |
| `description` | **IN** | no | strip; non-blank; explicit `null` → **422** |
| `image` | **IN** | no | https URL (see below) **or** uploaded file; explicit `null` → **422** |
| logistics / location / tracker / tracking | **OUT** | — | admin PATCH / existing tracker routes |

Any tracker stage, including `drop_finished` (recap still shows the creative).

### Endpoints + authz

1. **`PATCH /api/brands/me/drops/{drop_id}`** — JSON creative patch.
   - Authz: `CurrentBrand` + `resolve_brand_drop` (**404** if not owner / missing).
   - Request: `BrandDropCreativePatch` (`extra="forbid"`). Omit vs null via
     `model_dump(exclude_unset=True)` (mirror `OrgProfileUpdate` /
     `AdminDropConfigPatch`).
   - `{}` → **200** noop, return current `BrandDropDetailResponse` (re-fetch;
     do not hand-assemble).
   - Unknown keys (incl. `capacityTotal`, `location`) → **422**.
2. **`POST /api/brands/me/drops/{drop_id}/image`** — multipart file upload
   (same authz). Replaces the hero. Response: same detail shape as PATCH.
3. **`GET /api/drops/{drop_id}/hero`** — **public** (no auth) image bytes so
   `<img src>` works without a Bearer header. **404** if the drop has no
   stored upload (URL-only heroes stay on the external URL). Do not leak
   other drop fields.

Service lives in `services/drops.py` (keep routes thin). Do **not** extend
`PATCH /api/admin/drops/{id}` with these fields in this gap.

### Image rules

Column stays `drops.image` `String(1024)` NOT NULL (the URL orgs/brands render).

**Replace via URL (PATCH `image`):**

- Allow **http(s)** only (same spirit as `spa.unvalidated-post-href`). Reject
  `javascript:`, `data:`, blanks. Max 1024 after strip. **422** otherwise.
- Writing a URL **clears** any stored upload bytes so GET hero 404s and
  consumers use the new URL.

**Upload (multipart):**

- No object store in this repo. Store bytes on the drop (new nullable
  `image_blob` + `image_content_type` columns, or a 1:1 `drop_hero_images`
  table). After save, set `drops.image` to the **absolute public hero URL**
  (API origin + `/api/drops/{id}/hero`) so existing `<img src={drop.image}>`
  sinks need no per-surface rewrite.
- Allow `image/jpeg`, `image/png`, `image/webp`. Cap **2 MiB**. **422** on
  type/size. Do not persist `data:` URLs in `drops.image`.
- Upload **replaces** prior blob + URL.

Local `img-src` is `'self' https: data:` (`frontend/public/serve.json`).
Production API is `https://api.bringthebuzzover.com` (`https:`). Dev must
write an `https` or same-origin URL the SPA can load — use the configured
public API base, not a bare relative path that the org feed would resolve
against `www`.

### FE

On **`/brand/drops/:dropId`** (not the request form): campaign editor for
title, description, current picture preview, **file input** (upload) and
**URL field** (replace). Save omitted keys. Invalidate `["brand-drop-detail",
id]` + `["brand-drops"]`. Surface 400/422 via existing error pattern.
Create (`/brand/requests/new`) stays title+description; picture is an
after-create edit.

Org `DropFeedCard` / drop detail / campaign row keep reading `image` — no
org UI change beyond seeing the new asset.

### Tests

- Other brand / org / anon → 401/403/404 as existing ownership pattern;
  missing drop → 404; unknown PATCH key → 422; `{}` → 200 noop.
- PATCH title+description; GET brand detail + org feed item reflect values.
- PATCH `image` https URL; blob cleared; org card `src` is that URL.
- Upload jpeg/png/webp under cap → 200; `GET .../hero` returns bytes +
  content-type; `drops.image` is the public hero URL.
- Oversize / `text/plain` / `data:` PATCH → 422, row unchanged.
- Explicit null on title/description/image → 422.
- FE: editor present on brand drop detail; smoke or RTL as repo pattern.

### Explicit OUT

- Location, capacity, window, units, hashtag, tracker (admin / existing).
- Admin PATCH title/description/image (still Phase 2 of `brand.drop-create-thin`).
- Image on **create**.
- R2/S3/Railway volume; CDN.
- Changing picture after orgs have applied does **not** notify orgs (v1).

## PRODUCT (when this gap is un-parked)

Add to §5.2 that the owning brand may edit **title, description, and hero
picture** after publish; Buzz still owns logistics and tracker stages.
Do not widen brand PLG into capacity/window/hashtag here. **Not part of the
current LAUNCH revamp** — admin writes creative until this ships.
