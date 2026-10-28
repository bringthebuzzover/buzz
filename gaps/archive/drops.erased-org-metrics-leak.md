---
id: drops.erased-org-metrics-leak
title: Erased org stays on the drop and its metrics still count
kind: invariant_break
severity: P1
status: fixed
surface: drops
evidence:
  - path: backend/app/services/admin_erase.py
    note: Org erase used to keep accepted applications, links, and numeric post metrics
  - path: backend/app/services/brands.py
    note: Drop totals, dashboard totals, and engagement series sum every linked post
  - path: backend/app/services/admin_read.py
    note: Admin drop applicants, linked-post count, and allocated units use the same rows
  - path: PRODUCT.md
    note: §3.1.2 now removes seats and metrics; §4.3 keeps that rule for brand erase and IG switch only
repro: |
  Accept an org on a live drop, link a post with likes and reach, then erase the
  org from /admin/orgs. Brand drop detail, the brand drops list, and
  GET /api/brands/me/aggregate still included that org and its metrics.
  Observed 2026-10-28 on drop 647ea986-5af0-44c8-b5ff-03cbddf2d2fd after org
  798bf694-9ebf-41fc-8fda-57eec7f15e1a was erased (tombstone "Deleted organization"
  / caption "[removed]"); replacement org d76c91b2-b8c1-4157-8f61-d046b7c9d2a1
  was a separate row and was not the leak.
fix_when: |
  A deleted org is not a participant on brand drop pages, campaign lists, or
  dashboards, and its posts and metrics are absent from brand, admin, and
  aggregate totals. Already-erased rows are cleaned by an idempotent migration.
  Tests cover drop participants, drop totals, and dashboard totals.
---

# Erased org still counted

Erase scrubbed identity and rewrote the post to caption `[removed]`, but it
kept the accepted `drop_applications` row, the `post_campaign_links` row, and
the numeric columns on `social_posts` (likes, comments, reach, other insights).
Every brand and admin total is a live sum of those rows. There is no stored
aggregate and no CSV export. `metric_sync` already skipped erased orgs, so it
was not re-adding numbers; the old numbers simply stayed linked.

Fix is cleanup at erase time, not a filter on each reader. The same deletes
run in migration `c8d9e0f1a2b3` for orgs already `status = erased`. Deploy
applies that migration. Do not run it by hand against production. Downgrade
cannot restore the deleted rows.

Brand erase is unchanged: org My Campaigns still shows a tombstone brand name,
and that brand's drops and org metrics stay. An Instagram account switch still
keeps the previous account's last-known post metrics.

## Follow-up

Admin still has no remove-participant action for a **live** org that should
leave one drop without erasing the account. That is a separate flow (unlink,
shipments, allocated units, capacity, optional email) and is not part of this
fix. See `admin.remove-participant-from-drop`.
