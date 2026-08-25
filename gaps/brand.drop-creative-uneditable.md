---
id: brand.drop-creative-uneditable
title: Owning brand cannot edit drop title, description, or picture after create
kind: ux_hole
severity: P2
status: open
surface: brand
evidence:
  - path: backend/app/routes/brands.py
    note: POST /api/brands/me/drops is the only brand write; no PATCH for owned drops
  - path: backend/app/schemas/drops.py
    note: BrandDropCreateRequest is title+description only; image is not on create
  - path: backend/app/services/drops.py
    note: create_brand_drop hardcodes image=https://placehold.co/600x400/png
  - path: frontend/src/pages/brand/BrandRequestDropPage.tsx
    note: Request form has working title + short message; no picture control
  - path: frontend/src/pages/brand/BrandDropDetailPage.tsx
    note: Header renders title+description read-only; image is unused on this page
  - path: frontend/src/components/org/DropFeedCard.tsx
    note: Org feed hero is <img src={drop.image}> — every product-created drop is a placeholder
  - path: backend/app/schemas/admin.py
    note: AdminDropConfigPatch extra=forbid; title/description/image were OUT of brand.drop-create-thin
  - path: backend/app/models/drop.py
    note: title String(255), description Text, image String(1024) NOT NULL — URL column, no blob
  - path: PRODUCT.md
    note: §5.2 brand submits a request then sees a read-only tracker; does not say creative is frozen
repro: |
  1. Brand POST /api/brands/me/drops {title, description}. 200. image is always
     https://placehold.co/600x400/png.
  2. PATCH /api/brands/me/drops/{id} → 405. No other brand write exists.
  3. Open /brand/drops/:id — title and description are static text; no edit,
     no picture.
  4. Org browse card for that drop shows the placehold.co hero.
fix_when: |
  Owning brand can change title, description, and picture (replace URL or
  upload a new file) on an existing drop they own. Org feed / detail / campaign
  cards pick up the new creative. Other brands 404. Logistics stay admin-only.
  PRODUCT §5.2 notes brand-owned creative is editable after request. Tests
  cover authz, omit-vs-null, validation, and SPA editor. Locked v1 below.
---

# Brand cannot edit drop creative after create

`brand.drop-create-thin` shipped **admin** logistics PATCH and explicitly left
`title` / `description` / `image` **OUT** as brand-owned. There is still **no
brand write** after `POST /api/brands/me/drops`. Create never accepts a
picture, so every product-created drop ships the placehold.co hero to the org
feed.

PRODUCT §5.1–§5.2 keeps **logistics** with Buzz (capacity, window, units,
hashtag, tracker). It does not freeze the brand’s campaign copy or hero.
Typos and a missing picture are unrecoverable in-product today.

## Locked v1

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

## PRODUCT

Add to §5.2 that the owning brand may edit **title, description, and hero
picture** after the request; Buzz still owns logistics and tracker stages.
Do not widen brand PLG into capacity/window/hashtag here.
