---
id: admin.drop-hide-unhide
title: No way to hide a published drop from every consumer portal
kind: ux_hole
severity: P2
status: fixed
closed_in: dcc1e0d
surface: admin
evidence:
  - path: backend/app/models/drop.py
    note: No hidden/recalled timestamp; published_at is the only visibility latch besides drop_finished
  - path: backend/app/services/admin.py
    note: publish_drop is one-shot 409 if already published; no hide/unhide mutation
  - path: frontend/src/pages/admin/AdminDropDetailPage.tsx
    note: Tracker can advance to drop_finished; no hide/unhide control or title-confirm
  - path: backend/app/services/drops.py
    note: Org feed/detail/apply/notify only require published_at + not finished
  - path: backend/app/services/campaigns.py
    note: My Campaigns lists every non-denied application; no hide filter
  - path: backend/app/services/brands.py
    note: Brand drop list/detail/aggregates include every owned drop (drafts too)
  - path: PRODUCT.md
    note: §5.2 unpublished drafts stay brand-visible; drop_finished stays on all history surfaces; no recall/hide
repro: |
  Publish a drop (or use a seed published campaign). It appears on the org
  feed (when window/state allows), org My Campaigns after apply, brand
  /brand/drops and aggregate dashboard, and /admin/drops. There is no admin
  action that removes it from those surfaces while keeping the row. Advancing
  to drop_finished still leaves org/brand/admin history. Clearing published_at
  is not an API and would re-expose a draft to the brand.
fix_when: |
  PRODUCT documents hide/unhide (not drop_finished, not unpublish).
  Hidden published drops leave no in-app trace for org or brand consumers
  (including prior applicants and admin View-as those portals): feed, apply,
  Notify Me, drop deep links, My Campaigns, brand list/detail, compare table,
  and brand aggregate KPIs omit the drop; consumer APIs 404 / DROP_NOT_OPEN
  with no “withdrawn” copy.
  Admin default /admin/drops omits hidden rows; ?hidden=1 (or equivalent) and
  /admin/drops/:id still work with a Hidden pill and hide/unhide.
  Hide allowed at any post-publish stage; unhide restores the same drop.
  Confirm hide by typing the exact drop title. Default no email; optional
  checkbox to email the brand only (withdrawn). Unhide is silent.
  Jobs skip hidden drops. Applications/posts/tracker remain in DB. Hidden
  seats do not count as live concurrent participation. Ticket stays converted.
  Tests cover hide/unhide, consumer 404, admin filter, opt-in brand email,
  jobs skip. Archive with closed_in. Out of scope: per-org tracking numbers.
---

# Hide / unhide a published drop (no consumer trace)

Shipped: `drops.hidden_at`, admin hide/unhide APIs and danger-zone UI, consumer
omit/404, jobs skip, PRODUCT §5.2.2.

Ops need a kill switch for **“this never should have been published”** (wrong
window, test campaign, bad creative). Today the only nearby states are
**unpublished draft** (brand still sees it) and **`drop_finished`** (everyone
still sees history). Neither is a total hide.

## Locked v1 (2026-09-08)

| Decision | Lock |
| -------- | ---- |
| Intent | Mistake publish, not “campaign complete” |
| Name in admin | **Hide campaign** / **Hidden** |
| Storage | New timestamp (e.g. `hidden_at`); **keep** `published_at` |
| Who is a consumer | Org and brand users, including admin **View as** those portals |
| Consumer trace while hidden | **None** — omit from lists; 404 / `DROP_NOT_OPEN`; **no** withdrawn copy |
| Admin | Default list omits; filter + direct detail URL remain; unhide lives here |
| When | Any stage **after publish** (drafts already unpublished) |
| Reversible | **Yes** — hide/unhide; unhide restores the same drop and URLs |
| Confirm hide | Type the **exact drop title** (same family as org erase) |
| Confirm unhide | Normal confirm is enough |
| Email default | **None** (no org mail, no auto-deny) |
| Email opt-in | Checkbox **off** by default: email **brand only** (withdrawn / link dead) |
| Unhide mail | Silent (no “it’s back”) |
| Ticket | Stay converted; do not mint a new drop |
| Jobs | Skip notify reminders, autoclose, autolink, metric sync for this drop |
| KPIs | Rows may stay in DB; **not** on brand dashboards while hidden |
| Concurrent seats | Hidden drop does **not** count as live participation |
| Not this | `drop_finished`; clearing `published_at`; auto-deny applicants |

Out-of-band traces (publish email already in Gmail, screenshots) cannot be
erased. In-app, consumers must not be able to prove the drop exists.

If the brand was emailed withdrawn and admin later **unhides**, they only learn
via the dashboard. Accept that.

## Why not the nearby states

| Mechanism | Why it fails this intent |
| --------- | ------------------------ |
| `published_at = null` | Brand drafts are still visible; invites a second Publish on a row that already has tracker events, applicants, and a sent mail |
| `drop_finished` | Org My Campaigns + brand monitor keep the campaign as history |
| Deny all applicants | Would notify orgs they were decided; leaks that the campaign existed |

## Implementation sketch (when executing)

1. **PRODUCT** — short §5.2 / admin ops paragraph matching the table (hard stop
   was the lock above; write it in the same change as code).
2. Column + admin `POST` hide (title confirm + `notify_brand: bool`) and unhide.
3. Shared “not hidden” predicate on org feed/apply/notify, campaigns list/detail,
   brand list/detail/**aggregates**, admin default list; jobs same predicate.
4. Admin drop detail danger zone (not next to Advance stage): title field,
   optional brand-email checkbox, Hidden pill, unhide.
5. Do **not** couple to per-org tracking numbers (separate product change).

## Related

- PRODUCT §5.2 (publish, unpublished drafts, brand tracker, `drop_finished`)
- PRODUCT §3.1.2 (erase confirm-by-typing pattern)
- PRODUCT §4.3 KPI preservation is for **org erase**, not a requirement to show
  recalled-campaign stats on brand views
- `frontend/src/pages/brand/BrandAggregateDashboardPage.tsx` — must exclude
  hidden drops from compare/aggregates
- Publish mail: `send_drop_published_email` (cannot unsend)
