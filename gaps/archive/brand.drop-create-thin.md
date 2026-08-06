---
id: brand.drop-create-thin
title: Drop logistics (capacity, window, units, hashtag) have no product write path
kind: ops_completeness
severity: P2
status: fixed
closed_in:
surface: brand
evidence:
  - path: backend/app/schemas/drops.py
    note: BrandDropCreateRequest is title+description only; response still returns capacity/window/hashtag
  - path: backend/app/services/drops.py
    note: create_brand_drop hardcodes capacity=10, open+1d/close+8d, units=None, never sets campaign_hashtag
  - path: backend/app/routes/admin.py
    note: admin can tracker/tracking/reopen only — no PATCH for capacity/window/units/hashtag
  - path: frontend/src/pages/admin/AdminDropDetailPage.tsx
    note: displays capacity/window/hashtag read-only; no editors
  - path: backend/app/jobs/autolink_scan.py
    note: campaign_hashtag/both match reasons need non-null hashtag; scan also requires brand.instagram_handle
  - path: PRODUCT.md
    note: §5.1–§5.2 brand request-only; Buzz rep owns logistics — intent OK, admin write path missing
  - path: backend/app/services/posts.py
    note: manual link_post still attributes without hashtag/autolink
repro: |
  1. Brand submits /brand/requests/new (title+description only).
  2. Response: capacityTotal=10, totalProductUnits=null, campaignHashtag=null,
     applyOpenAt≈now+1d, applyCloseAt≈now+8d.
  3. Admin drop detail shows hashtag “None — auto-link matches on the brand handle only”; no edit.
  4. Live accepted campaign + post with #Tag only → autolink_scan yields 0 hashtag suggestions.
  5. Same post with @brandhandle → handle suggestion; org manual link-post still works.
fix_when: |
  Phase 1 locked below is shipped end-to-end: PATCH /api/admin/drops/{id} with
  CurrentAdmin authz; AdminDropConfigPatch omit-vs-null via defaults +
  model_dump(exclude_unset=True) (mirror OrgProfileUpdate); body fields
  capacity_total, apply_open_at, apply_close_at, total_product_units,
  campaign_hashtag (image/location OUT); aware window times (naive → 422);
  validation matrix; stage gate; AdminDropDetail editors; tests checklist
  including omit vs explicit null. Brand create stays title+description.
  Scan handle-gate and DB CHECKs remain OUT.
---

## Problem

Brand drop create only accepts `title` + `description`. Server hardcodes
capacity 10, a fixed +1d/+8d window, spot-only (`total_product_units=None`),
placeholder image, generic location, and never writes `campaign_hashtag`.

PRODUCT §5.1–§5.2 intentionally makes brands **request-only** (rep owns
logistics). The real defect is that **Buzz admin also cannot write** those
fields — only seed/SQL can. Admin UI already *displays* capacity / window /
hashtag as read-only.

## Attribution nuance (contradicts prior gap body)

- **Hashtag / `both` autolink:** unreachable for product-created drops (null
  hashtag). Cron runs; only the data path is missing.
- **Handle autolink:** still works when `instagram_handle` is set.
- **Manual `link_post`:** still attributes. Prior claim that “no handle ⇒ never
  accrue attributed posts” is **false**.

Scan query also requires `Brand.instagram_handle.isnot(None)` — hashtag-only
rows still need a handle on the brand to be scanned at all.

## Severity

Keep **P2**. Reframe kind toward **ops_completeness** (admin config), not
brand PLG self-serve. High for ops realism (every create is identical);
medium for hashtag campaigns; low when handle + manual link suffice.

## Locked v1 fix (Phase 1)

### 1. PATCH fields (exact)

| Field | v1 | Clearable? | Notes |
| --- | --- | --- | --- |
| `capacity_total` | **IN** | no | int ≥ 1; explicit `null` → **422** |
| `apply_open_at` | **IN** | no | aware UTC; see §2b wire + §3 naive rule |
| `apply_close_at` | **IN** | no | aware UTC; same |
| `total_product_units` | **IN** | **yes** | `int ≥ 1` or explicit JSON `null` → spot-only |
| `campaign_hashtag` | **IN** | **yes** | string or explicit JSON `null` → clear |
| `image` | **OUT** | — | stay create defaults / seed |
| `location` | **OUT** | — | stay create defaults / seed |
| `title` / `description` | **OUT** | — | brand-owned; not this endpoint |
| `tracking_number` / stage / reopen | **OUT** | — | existing `/tracker`, `/tracking`, `/reopen` |

### 2. Endpoint + authz

- **`PATCH /api/admin/drops/{drop_id}`** — new config route alongside existing
  `/tracker` and `/tracking` (do not overload those).
- **Authz:** `CurrentAdmin` only (same as other `/api/admin/drops/*`).
- **404** if drop missing.
- **Request:** `AdminDropConfigPatch` in `schemas/admin.py`.
- **Response:** full `AdminDropDetail` — **re-fetch via `get_drop_detail`
  after flush** (do not hand-assemble a partial dict). Same shape as
  `GET …/drops/{id}`.
- **Service:** `update_drop_config` in `services/admin.py` (keep route thin).
- **Empty body `{}`:** 200 noop, return current detail (mirror
  `PATCH /api/orgs/me`).
- **`extra="forbid"`:** unknown keys (incl. `image`/`location`/`title`) → **422**.

### 2a. Omit vs JSON null (Pydantic pattern — locked)

Mirror **`OrgProfileUpdate`** (`schemas/orgs.py` + `update_org_profile`):

1. Declare every patch field as `T | None = None` (default `None` means
   “unset placeholder”, not “clear”).
2. Apply with **`payload.model_dump(exclude_unset=True)`** — only keys present
   in the JSON body appear. Equivalent check: `field in payload.model_fields_set`.
3. **Omit** → not in dump / not in `model_fields_set` → leave DB column unchanged.
4. **Explicit JSON `null`** on clearable fields (`total_product_units`,
   `campaign_hashtag`) → in `model_fields_set`, value `None` → write SQL NULL.
5. **Explicit JSON `null`** on non-clearable fields (`capacity_total`,
   `apply_open_at`, `apply_close_at`) → **422** via `@field_validator` raising
   `ValueError("must not be null")` (same as `org_name` on org PATCH) — never
   flush an IntegrityError.
6. Do **not** invent a custom `Unset` sentinel type; `exclude_unset` /
   `model_fields_set` is the repo pattern.

### 2b. Request datetime wire format

Responses already serialize window times as **epoch-ms ints**. Request body
must accept the same so the SPA can round-trip GET → PATCH without ISO
conversion:

- Wire: **`applyOpenAt` / `applyCloseAt` as epoch-ms integers** (camelCase).
- Convert **once in the schema** (`Annotated` + `BeforeValidator`): int →
  `datetime(..., tzinfo=timezone.utc)`. **Pass `None` through unchanged**
  (clearable fields / unset); reject `bool` / `float` / ISO strings with
  **422**. Service receives aware `datetime` only when the field was set.

- SPA + route tests use epoch-ms only. Do not document ISO as the contract.

### 3. Validation matrix

Schema failures → **422** `VALIDATION_ERROR` (FastAPI handler). Business-rule
failures after merge → **400** `VALIDATION_ERROR` unless noted **409**.

When a field is in `model_fields_set`, after merge with current row:

| Rule | Reject when | Status |
| --- | --- | --- |
| Capacity null | explicit `null` | 422 |
| Capacity floor | `capacity_total < 1` (Pydantic `ge=1`) | 422 |
| Capacity vs accepted | `capacity_total < count(decision=accepted)` | 400 |
| Window null | explicit `null` on either timestamp | 422 |
| **Naive datetime** | parsed value has `tzinfo is None` | **422 — reject; do not coerce** |
| Window order | merged `apply_open_at >= apply_close_at` | 400 |
| Units shape | non-null and `< 1` (Pydantic `ge=1` when not null) | 422 |
| Units vs allocated | non-null and `< sum(allocated_units)` over accepted (nulls as 0) | 400 |
| Mode flip after finalize | `total_product_units` in `model_fields_set` and NULL↔non-null vs current row while `applicant_selection_finalized_at` set | 409 |
| Hashtag length | normalized string length > 255 (`drops.campaign_hashtag` column) | 422 |
| Hashtag normalize | see below; empty after normalize → store `null` | — |

**Naive datetimes — pick locked:** **reject** with **422**. Never
`replace(tzinfo=UTC)`. (Response-side `to_epoch_ms` may still coerce for
reads; that does not apply to this write path.)

**Hashtag normalize (write path):** strip surrounding whitespace; strip one or
more leading `#`; lowercase; if empty → store `null`; else max 255 chars.
Match is already `re.IGNORECASE` in `autolink_scan._match`.

**Window / Open-Closed semantics:** no extra feed flags. Feed status stays
derived (`getDropFeedStatus`). Extending close while unfinalized can
keep/return Open; finalized still Closed for new applies even if the window
is widened. Do not invent mid-window accept behavior
(`product.capacity-closed-during-open-unreachable`).

### 4. Mid-life edits (by stage)

Stages: `request_received` → `finalizing_agreements` → `awaiting_products` →
`drop_active` → `drop_finished`.

| Fields | Allowed when | Reject |
| --- | --- | --- |
| `capacity_total`, `apply_open_at`, `apply_close_at`, `total_product_units` | stage ∈ {`request_received`, `finalizing_agreements`, `awaiting_products`} **and** validation matrix passes | stage ∈ {`drop_active`, `drop_finished`} → **409** |
| `campaign_hashtag` | **any** stage (including live/finished) | only normalize / authz failures |

**Atomic request:** if **any** logistics field above is in `model_fields_set`
while stage is live/finished → **409 entire body** (do not partially apply
hashtag). Hashtag-only body on live/finished → **200**.

Pre-live includes post-finalize `awaiting_products`: capacity/units may still
move within floors; **mode flip NULL↔units remains 409 once finalized**.

### 5. FE (AdminDropDetail v1)

Ship editors **only** on the existing Configuration panel for:

1. Capacity (`capacityTotal`)
2. Unit budget (`totalProductUnits` — nullable / clear → send JSON `null`)
3. Apply window (`applyOpenAt` + `applyCloseAt` as **epoch-ms numbers**)
4. Campaign hashtag (`campaignHashtag` — clear → JSON `null`)

**Do not** add image/location editors in v1. Keep tracker / reopen / tracking
repair as today. Disable logistics editors (or hide submit) when stage is
`drop_active` / `drop_finished`; keep hashtag editable. Surface API
400/409/422 messages via existing `ErrorNote` pattern. Hook:
`usePatchAdminDropConfig(dropId)` built on **`useAdminMutation`** (invalidate
**all** `["admin"]` query keys — not detail-only). Omit unchanged keys from
the JSON body (do not send `null` for “leave alone”).

### 6. Tests checklist

- Non-admin → 401/403; missing drop → 404; unknown key → 422; `{}` → 200 noop.
- Happy path: patch all five fields (window as epoch-ms); GET detail reflects
  values; hashtag stored without `#`, lowercased.
- **Omit vs null (required):**
  - Body omits `totalProductUnits` / `campaignHashtag` → columns unchanged.
  - Body sends `"totalProductUnits": null` (pre-finalize) → column NULL.
  - Body sends `"campaignHashtag": null` → column NULL.
  - Body sends `"capacityTotal": null` or window null → **422**, row unchanged.
- Partial patch leaves omitted fields unchanged.
- `capacity_total` < accepted count → 400; `capacity_total < 1` → 422.
- `total_product_units` < sum allocated → 400; `0` → 422.
- Finalize then NULL↔units flip → 409.
- `apply_open_at >= apply_close_at` → 400.
- **Naive datetime** (if string path exists) → **422**; epoch-ms happy path → 200.
- Hashtag `"  #FooBar  "` → `"foobar"`; `""` / `"#"` / whitespace → `null`;
  >255 after normalize → 422.
- Stage `drop_active`/`drop_finished`: logistics field present → 409 entire
  request; hashtag-only → 200; mixed hashtag+capacity → 409.
- FE: Configuration editors present; logistics controls disabled/hidden on live
  stages; hashtag still editable (smoke or RTL as repo pattern allows).

### 7. Explicit OUT of this v1

- **Brand create expansion** (optional suggested logistics on
  `BrandDropCreateRequest`) — Phase 2.
- **Scan handle-gate relax** (`Brand.instagram_handle.isnot(None)` in
  `autolink_scan`) — Phase 2.
- **DB `CheckConstraint`s** (`models.missing-check-constraints`) — **OUT of this
  v1.** Application-layer validators above are mandatory. Ship CHECKs in that
  gap immediately after / as a paired follow-up; do not block Phase 1 archive on
  Alembic CHECKs.
- Image / location / title / description admin PATCH.
- Mid-window rolling accept (Fork B of
  `product.capacity-closed-during-open-unreachable`).
- Custom `Unset` sentinel type; ISO-only request datetimes as the SPA contract.

### 8. Phase 2 deferrals (one line each)

- Optional brand “suggested” capacity/window/units/hashtag on create; admin remains SOT.
- Admin PATCH `image` + `location` (and optional title/description repair).
- Relax `autolink_scan` to include hashtag-set drops even when brand handle is null.
- Ship `models.missing-check-constraints` CHECKs as defense-in-depth beside this write path.

## Recommended fix (phased) — summary

1. **Phase 1 (this gap):** Locked section above — admin PATCH + AdminDropDetail
   editors only.
2. **Phase 2:** Brand create stays thin or gains optional suggestions; image /
   location; scan handle-gate; DB CHECKs via sister gap.
3. Do **not** make brand the SOT for logistics without a PRODUCT change.

## Risks

Mitigated by floors + stage gate + finalize mode-flip 409. Remaining: ops can
still reshape an unfinalized Open window (intentional); lowering capacity to
exactly `accepted` while Open does not create mid-window Closed until accepts
exist (first-window accepted stays 0 — doc drift owned elsewhere).

## Plan verification

**Verdict: PASS_WITH_NITS**

Verified against Locked Phase 1 (§1–§8), `OrgProfileUpdate` /
`update_org_profile`, Drop columns, `AdminDropDetail` + admin drop routes,
finalize floors in `finalize_applicants`, `autolink_scan._match`, FE
`AdminDropDetailPage` Configuration panel + `useAdminHooks`, and sister gap
`models.missing-check-constraints`. No product code changes in this pass.

### PATCH design vs existing admin patterns

- **Authz / placement:** `CurrentAdmin` + thin route → service matches every
  `/api/admin/drops/*` handler. New `PATCH /api/admin/drops/{drop_id}` sits
  beside `/tracker` and `/tracking` without overloading them; FastAPI path
  specificity is fine (suffix routes stay distinct).
- **Schema home:** `AdminDropConfigPatch` in `schemas/admin.py` next to
  `TrackerAdvanceRequest` / `TrackingRepairRequest` is correct.
- **`extra="forbid"`:** Matches `OrgProfileUpdate`, stricter than current
  tracker/tracking request models (those omit forbid). Correct for a config
  write surface where `image`/`location`/`title` must hard-fail.
- **Omit vs null:** Exact mirror of org PATCH — `T | None = None` defaults,
  `model_dump(exclude_unset=True)`, non-clearable null →
  `ValueError("must not be null")` (see `org_name` / `test_patch_me_null_*`),
  clearable null → SQL NULL. Empty `{}` → 200 noop is already proven for
  `/api/orgs/me`. Do **not** set `validate_default=True` or empty bodies break.
- **Response shape (nit):** Sibling mutations (`/tracker`, `/tracking`,
  `/reopen`) return thin `camelize(dict)` payloads. Phase 1 returns full
  `AdminDropDetail` like `GET …/drops/{id}` — better for SPA round-trip and
  still thin at the route if implemented as
  `update_drop_config` + `get_drop_detail`. Intentional divergence; implement
  via re-fetch after flush, do not hand-build detail.

### Omit / null

| Body | Effect | Aligned? |
| --- | --- | --- |
| Key omitted | unchanged (`exclude_unset`) | yes — org pattern |
| `totalProductUnits` / `campaignHashtag`: `null` | clear | yes — nullable columns |
| `capacityTotal` / window: `null` | 422, no flush | yes — NOT NULL columns |
| Hashtag `""` / `"#"` after normalize → store `null` | documented | yes — UX choice; differs from org “blank string → 422” on clearable strings (acceptable) |

`Field(ge=1)` on `int | None` skips constraints when value is `None`; the
explicit null validators on non-clearable fields remain mandatory so null never
reaches IntegrityError.

### Epoch-ms validators

- Responses already serialize `apply_open_at` / `apply_close_at` via
  `to_epoch_ms` on `AdminDropDetail` — GET → PATCH round-trip as ints is the
  right SPA contract.
- **No existing request-side epoch→datetime helper** in the repo (serializers
  only). Phase 1 correctly invents `Annotated` + `BeforeValidator` once in the
  schema; service stays on aware `datetime`.
- Locked naive reject (no `replace(tzinfo=UTC)`) is correct and must not reuse
  read-side `to_epoch_ms` coercion.
- **Nits for implementers:**
  1. BeforeValidator must **pass `None` through** so the “must not be null”
     validator owns the 422 message.
  2. Reject non-`int` (bool, float, ISO string) → 422; do not rely on a looser
     datetime parser.
  3. OpenAPI may advertise `date-time` string unless annotated with an integer
     JSON schema — hooks are hand-typed today (`useAdminHooks`), so not
     blocking; worth a `WithJsonSchema` / equivalent if codegen is used later.

### Stage gate atomicity

- Logistics editable only in
  `{request_received, finalizing_agreements, awaiting_products}`; hashtag any
  stage — matches tracker semantics (pre-live / post-finalize awaiting still
  ops-configurable; live/finished frozen for capacity/window/units).
- **Atomic body rule is sound:** any logistics key in `model_fields_set` on
  live/finished → **409 entire request** before setattr; hashtag-only → 200.
  Prevents mixed hashtag+capacity partial apply.
- Mode-flip `NULL↔non-null` on `total_product_units` after
  `applicant_selection_finalized_at` → 409 matches product modes in
  `Drop` docstring + finalize Rule 6 (units only when budget set).
- Floors match finalize accounting: accepted count; `coalesce(sum(allocated_units),0)`
  over `decision=accepted` (null units as 0).

### Finalize floors / feed semantics

- Capacity / units floors as **400 `VALIDATION_ERROR`** after merge match admin
  service style (`BuzzAPIException(..., status_code=400)`).
- Window order after merge → 400; no extra feed flags — consistent with
  `getDropFeedStatus` (finalized still Closed for applies even if window
  widened). Correctly defers mid-window accept to
  `product.capacity-closed-during-open-unreachable`.

### Autolink hashtag

- Write normalize (strip, strip leading `#`+, lower, empty→null, max 255)
  matches scan’s `(campaign_hashtag or "").lstrip("#")` +
  `#{re.escape(hashtag)}\b` with `re.IGNORECASE`.
- Leaving scan `Brand.instagram_handle.isnot(None)` gate **OUT** is correct;
  Phase 1 still unlocks hashtag/`both` matches when handle is set (the common
  case). Handle-gate relax stays Phase 2.

### FE hook feasibility

- Configuration panel already displays capacity / units / window / hashtag
  read-only — editors belong there; tracker/reopen/tracking stay as today.
- Hook name `usePatchAdminDropConfig(dropId)` fits `useSetDropTracking` /
  `useAdvanceTracker(dropId)`.
- Hook: `usePatchAdminDropConfig(dropId)` on **`useAdminMutation`** →
  invalidate all `["admin"]` keys (amended into Locked §5). Omit unchanged
  keys; clearables send JSON `null`; window fields send epoch-ms. `ErrorNote`
  pattern already used in `TrackerControls`.

### CHECK constraints out-of-scope

- **OK to OUT of Phase 1.** Application validators are mandatory and close the
  first product write path. Sister gap `models.missing-check-constraints` is
  P3 / parked and already frames CHECKs as defense-in-depth; Phase 1 §7 + §8
  explicitly schedule CHECKs immediately after / paired follow-up.
- Sister gap Locked/`fix_when` amended to “immediately after Phase 1”
  (2026-08-06).

### Residual risks (accepted)

- Unfinalized Open window reshape remains possible (intentional ops).
- Hashtag set without brand IG handle still won’t scan until Phase 2
  handle-gate (documented).
- No concurrent-edit locking beyond row flush (acceptable for admin v1).

### Blockers

None. Safe to implement as locked; address nits during impl (invalidate scope,
None-pass in BeforeValidator, re-fetch `AdminDropDetail`, optional OpenAPI int
schema / sister-gap wording).
