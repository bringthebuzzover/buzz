---
id: admin-autolink-on-demand
title: Admin trigger — Graph sync then autolink on a drop
status: shipped
updated: 2026-09-17
---

# Admin on-demand sync + autolink

**Shipped** on `main` (`492aa4c`). Behavior SOT is [`PRODUCT.md`](../../PRODUCT.md)
(admin: sync Instagram then autolink on an Active drop). This file is
provenance. Do not implement from here.

Brainstorm (2026-09-13), next to [`admin-late-add-org.md`](admin-late-add-org.md).

## Desired motion

From admin drop detail: one action that **pulls Instagram for this drop’s
accepted orgs, then runs autolink** so suggestions exist without waiting for
`cron-metric-sync` (~03:00) + `cron-autolink-scan` (~03:30). Works after
brand **finalize** (normal case). **Not** for finished / hidden / drafts.

Does **not** auto-confirm. Org still taps Confirm (or manual-links).

## Locked (2026-09-13)

| Fork | Lock |
| ---- | ---- |
| Action | **Sync + autolink**, not autolink-only. |
| Scope | This drop’s **accepted** orgs only. Not the global nightly job. |
| Stage | **`drop_active` only** (same mint gate as autolink). |
| Finished / hidden / draft | **Refuse.** |
| Confirm | Still org-side. Scan never auto-links. |

## As-built

- `sync_metrics` (`backend/app/jobs/metric_sync.py`): Graph `/me/media`
  discovery (30d) + per-post basics/insights refresh. Eligible orgs = accepted
  on `awaiting_products` / `drop_active` / `drop_finished`. Ends with a
  **global** follower-count walk — **do not** run that on this button.
- Org `POST /orgs/me/posts/refresh` is a DB reread, not Graph.
- `scan_autolink`: caption match on `social_posts`; `drop_active` only;
  needs brand `instagram_handle`; never confirms.
- Cron only; no admin trigger. Job Graph client timeout is 10s **per call**.

## Implementation notes (if promoted)

`POST /api/admin/drops/{id}/sync-and-autolink`:

1. 409 unless published, unhidden, `drop_active`.
2. Load accepted orgs on this drop.
3. Reuse metric-sync **per-org** discovery + in-window refresh (skip
   `_refresh_follower_counts`).
4. Then `scan_autolink` filtered to this drop.
5. Return honesty: orgs, discovered, refreshed, token skips, Graph failures,
   suggestions created. Seat/add is unrelated; this request **is** the sync,
   so surface partial success (some orgs skipped) rather than rolling back
   posts that already landed.

**Timeout:** a 10-org drop with ~20 in-window posts is hundreds of sequential
Graph calls (minutes). Do not run the global job. Extract org-scoped sync.
v1: wait in the request with a long timeout + “this can take a minute”
copy; if Railway/proxy cuts it off, fall back to a `job_runs` row and poll.
Missing/expired IG token → skip that org, still autolink whatever is in DB.

Hashtag-only brands with no `instagram_handle` still get no handle matches
(existing autolink skip).
