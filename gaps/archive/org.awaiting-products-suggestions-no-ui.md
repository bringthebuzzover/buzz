---
id: org.awaiting-products-suggestions-no-ui
title: awaiting_products stage has suggestions with no useful org UI
kind: ux_hole
severity: P3
status: fixed
closed_in:
surface: org
evidence:
  - path: backend/app/jobs/autolink_scan.py
    note: _LIVE_STAGES includes awaiting_products + drop_active; mints pending suggestions while shipping
  - path: frontend/src/pages/org/OrgCampaignDetailPage.tsx
    note: ApiPostSelector mounts only for org status active|finished (drop_active|drop_finished)
  - path: frontend/src/pages/org/OrgMyCampaignsPage.tsx
    note: awaiting_products maps to org status "accepted" (shipping), not "active"
  - path: backend/app/services/posts.py
    note: list/accept/dismiss APIs are not stage-gated for awaiting_products; accept/link only block drop_finished
  - path: PRODUCT.md
    note: §6.4 Accepted = awaiting product; post select when Active — UI matches PRODUCT; job is early
repro: |
  1. Accept org; advance drop to awaiting_products with brand instagram_handle set.
  2. Org has a FEED/REELS post whose caption mentions @handle (within apply_open−7d→now).
  3. Run autolink_scan → pending post_campaign_suggestions row; GET /api/campaigns/{id}/suggestions returns it.
  4. Open /org/campaigns/{id} → Accepted / Awaiting product only; no Suggested posts UI.
  5. Advance to drop_active → ApiPostSelector appears with Confirm/Dismiss.
fix_when: |
  Preferred close (fix A): autolink mint stages are `drop_active` only —
  rename or clearly comment the constant as mint-only (`_MINT_STAGES` /
  independent of `metric_sync._LIVE_STAGES`); update autolink module docstring;
  test `awaiting_products` → 0 suggestions (mirror finished exclusion);
  keep Active happy-path mint. Do **not** change `metric_sync` stage lists or
  tighten posts accept/link/dismiss APIs. Existing pending rows need no
  migration (deferred mint until Active). Soften “miss teasers” to “deferred
  mint.” Alternative B (mount ApiPostSelector earlier) requires PRODUCT change
  and is not the default close.
---

## Problem

Autolink mints `post_campaign_suggestions` starting at `awaiting_products`, but the
org campaign detail page only mounts `ApiPostSelector` (Suggested posts +
Link/Unlink) when org status is `active` or `finished` (`drop_active` /
`drop_finished`). During shipping the org sees Accepted / “Awaiting product”
and cannot confirm or dismiss suggestions in the SPA — even though list /
accept / dismiss APIs would work if called.

This is **job vs UI/PRODUCT timing**, not a wrong org stage label. PRODUCT §6.4
maps Accepted → shipping and Active → post management; the FE mapping matches.
The hole is that `_LIVE_STAGES` includes `awaiting_products` ahead of that rule
(same class as archived `jobs.autolink-after-drop-finished`, but temporary).

## Current behavior

| Layer | When | Behavior |
|---|---|---|
| Mint | `awaiting_products` or `drop_active`, accepted app, brand IG handle | `scan_autolink` writes suggestions |
| List / dismiss API | Owned campaign / pending suggestion | No stage gate |
| Accept / link API | Accepted app | Blocked only if `drop_finished` |
| Org UI | `status === "active" \|\| "finished"` only | `ApiPostSelector` |

Accepted-app org status mapping: `request_received` /
`finalizing_agreements` / `awaiting_products` → **`accepted`**; `drop_active` →
**`active`**; `drop_finished` → **`finished`**.

Admin attribution UI can show inflated `pendingSuggestionCount` during shipping
(“metrics understate reality until orgs confirm”).

## Severity

Softened **P2 → P3**: pending rows are not orphaned permanently — they remain
actionable once the drop goes Active. No data loss. Ops signal noise and a
temporary UX lag only. Keep as P2 only if shipping windows are long and early
UGC is an intentional product expectation.

## Locked v1 fix (preferred A)

1. In `autolink_scan.py`, mint only at `drop_active`:
   `(BrandTrackerStage.DROP_ACTIVE.value,)` (trailing comma).
2. Rename constant to `_MINT_STAGES` (or keep `_LIVE_STAGES` with an explicit
   comment that it is **independent** of `metric_sync._LIVE_STAGES`) — do
   **not** “align” the two tuples.
3. Update module docstring / “live enough” comments (no longer claim
   `awaiting_products` mint).
4. Tests (required): mirror `test_autolink_ignores_drop_finished` for
   `awaiting_products` → `applications_scanned == 0`, `suggestions_created == 0`;
   keep Active happy path. Optional: advance stage then remint.
5. **OUT:** metric_sync stage changes; posts.py stage gates; FE remap of
   `awaiting_products` → `active`; Option B/C; pending-row migration.

## Recommended alternatives (not default)

**B:** Mount mutable `ApiPostSelector` for `accepted` when stage ≥
`awaiting_products` — requires PRODUCT change.

**C:** Hybrid banner/dismiss-only on Accepted — more surface, little attribution
gain.

## Risks

- **A:** Deferred mint until Active (not permanent miss) — window is
  `apply_open_at - 7d` → `now`; re-scan after Active still works;
  already-minted rows remain visible when Active.
- **B:** Orgs may link before product receipt; metrics during shipping;
  PRODUCT/docs drift; concurrent-campaign link races amplify.
- Do not tighten accept/dismiss APIs to `drop_active` without the matching FE
  change (or API and UI diverge again).

## Notes vs prior gap text

Prior claim implied “no useful suggestion UI” / vague “early live stages.”
UI **exists** for Active; hole is stage timing only. Stage mapping is correct.

## Plan verification

**Verdict: PASS_WITH_NITS**

### Diagnosis check

Confirmed end-to-end:

| Layer | Code | Behavior |
|---|---|---|
| Mint | `backend/app/jobs/autolink_scan.py` `_LIVE_STAGES` | `(awaiting_products, drop_active)` — mints while shipping |
| Org status map | `OrgCampaignDetailPage.apiDeriveStatus` / `OrgMyCampaignsPage.deriveApiStatus` | `awaiting_products` → `accepted`; `drop_active` → `active` |
| Org UI gate | `OrgCampaignDetailPage` | `ApiPostSelector` only when `status === "active" \|\| "finished"` |
| PRODUCT | §6.4.1–§6.4.2 | Accepted = awaiting product; post select when **Active** |
| APIs | `posts.py` `_reject_if_drop_finished` only | list/accept/dismiss/link not gated on `awaiting_products` |

Hole is **job timing ahead of PRODUCT/UI**, not a wrong org label. Same class as archived `jobs.autolink-after-drop-finished` (mint while UI cannot act), but temporary because Active eventually mounts mutable UI.

### Is changing `_LIVE_STAGES` → `(DROP_ACTIVE,)` sufficient and correct?

**Yes — sufficient for fix_when under preferred option A.**

- Single mint gate: `scan_autolink` filters accepted apps with `Drop.brand_tracker_stage.in_(_LIVE_STAGES)`. Narrowing that tuple is the whole mint-path change.
- Aligns with PRODUCT §6.4.2 (Active-only post management) and with the finished-stage precedent (`test_autolink_ignores_drop_finished`).
- No FE change required; do **not** remap `awaiting_products` → org `active`.
- No API stage tightening required for A (and should not be done without FE — gap Risks already correct).
- Option B/C are product/surface expansions; A is the minimal correct close.

**Not sufficient alone as a patch checklist** without the nits below (docs + explicit non-goals + test), but the *approach* is correct.

### Window / “missed teasers” (Risk A precision)

Risk wording “Miss teaser matches during shipping” is **delay, not loss**:

- Scan window is `apply_open_at - 7d` → `now` (not “since drop_active”).
- Posts discovered during `awaiting_products` (metric_sync still eligible there) remain matchable on the first `autolink_scan` after stage → `drop_active`.
- Cron order (`metric_sync` then `autolink_scan`) unchanged; no new discovery blackout from A.

### Side effects on `metric_sync` live stages

**None if scoped correctly.**

- `metric_sync.py` defines its **own** module-private `_LIVE_STAGES` = `(awaiting_products, drop_active, drop_finished)` — not imported from autolink.
- Docstring there explicitly says shipping/finished eligibility is intentional; finalize→awaiting blackout must not be “fixed” by shrinking sync stages.
- Prior cluster `jobs-autolink` already required: do **not** change metric_sync stage lists when touching autolink stages.
- **Hard non-goal for this fix:** do not “align” the two tuples. Shared name `_LIVE_STAGES` is a footgun — see nits.

### Existing pending rows

- Pre-deploy / in-flight `post_campaign_suggestions` minted at `awaiting_products` stay pending (`confirmed_at`/`dismissed_at` null).
- `UNIQUE(post_id, application_id)` → no duplicate remint after Active; row surfaces when `ApiPostSelector` mounts.
- No migration/backfill/dismiss required for correctness (matches gap severity: temporary UX lag, not orphan forever).
- Admin `pending_suggestions` / `pending_suggestion_count` may still count those legacy shipping-minted rows until Active + confirm/dismiss; **new** shipping noise stops after A.
- Optional cleanup of shipping-only pendings is out of scope and would discard the “already-minted remain visible when Active” benefit.

### Recommended test approach

Mirror `test_autolink_ignores_drop_finished` in `backend/tests/test_jobs.py`:

1. **Primary (required):** accepted app + brand handle + matching FEED/REELS caption; drop stage `awaiting_products` → `applications_scanned == 0` and `suggestions_created == 0`.
2. **Regression:** keep existing `_accepted_live_ctx` / happy-path tests on `drop_active` minting.
3. **Nice-to-have:** same fixture at `awaiting_products` (0 created) → advance stage to `drop_active` → re-run scan → `suggestions_created == 1` (proves delayed mint + window coverage).
4. No FE/E2E required for A (UI already correct). Do not add metric_sync stage tests that change eligibility.

### Implementation nits — amended into Locked v1 (2026-08-06)

Folded: `_MINT_STAGES` / independence from metric_sync; docstring update;
trailing-comma tuple; Risk A “deferred mint”; no posts.py gate tighten.

### Out of scope / stop_if

- Mounting `ApiPostSelector` for `accepted` / PRODUCT rewrite (B).
- Changing org status mapping.
- Changing `metric_sync` eligibility.
- Data migration of existing pending rows.
