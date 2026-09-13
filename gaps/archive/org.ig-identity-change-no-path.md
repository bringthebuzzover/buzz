---
id: org.ig-identity-change-no-path
title: Orgs have no path to change Instagram identity after bind
kind: ux_hole
severity: P2
status: fixed
surface: org
evidence:
  - path: backend/app/schemas/orgs.py
    note: PATCH /orgs/me forbids instagram_handle; handle is Graph/OAuth-owned
  - path: frontend/src/pages/org/OrgPortalProfilePage.tsx
    note: Profile shows Instagram identity as read-only; request panel is the change path
  - path: backend/app/services/auth.py
    note: Active login matches Graph id only; unknown id → ORG_APPLY_REQUIRED (no rebind)
  - path: backend/app/jobs/metric_sync.py
    note: Refresh fetch failure continue-skips; last likes/comments/insights stay (not zeroed)
  - path: backend/app/models/social_post.py
    note: Posts owned by org_id + Graph media external_id, not by handle
  - path: backend/app/models/post_link.py
    note: Attribution is post_id → application_id; independent of username
  - path: PRODUCT.md
    note: §3.1.4 names the request + admin-review path
repro: |
  Active org, bound Graph account A, with linked campaign posts.
  1. Profile → Instagram is read-only; PATCH instagramHandle → 422.
  2. Rename @ on the same Instagram account, then Login with Instagram
     → username syncs; links stay (test_relogin_syncs_instagram_username).
  3. Login / reconnect with a different Instagram account B
     → 400 ORG_APPLY_REQUIRED; Buzz row for A unchanged.
fix_when: |
  PRODUCT names the request + admin-review path. Locked behavior below is
  implemented: no free-text PATCH of instagramHandle; request requires
  current @, requested @, and a reason; admin approve/deny; account switch
  is Connect + tester re-add (never write Graph id from a typed @). After
  switch, old social_posts and post_campaign_links remain; refresh failures
  leave last-known likes/comments/insights (not 0, not deleted); new-account
  posts discover and update; follower_count becomes the new account.
  Tests cover rename, switch with live + finished linked posts, and the
  freeze-not-zero refresh path. Do not archive on a self-serve handle field.
---

# Org Instagram identity change (no path today)

Shipped 2026-09-13 as PRODUCT **§3.1.4**. Org profile request + admin
review. Handle field stays read-only. Brand handle is a separate hole
([`brand.ig-handle-no-change-path`](../brand.ig-handle-no-change-path.md)).

This is a **request + admin review** hole, not “make the profile field
editable.” A free-text `@` write would desync `users.instagram_username`
from the token’s Graph account.

## Two cases (do not treat as one field)

| Case | What changed | Today | After this gap |
| ---- | ------------ | ----- | -------------- |
| **Rename** | Same Graph `instagram_user_id`, new `@` | Next login/reconnect overwrites `users.instagram_username` (`_apply_ig_credentials`). 409 if the new `@` is claimed. | Request is ops visibility. Approve = tell them to Login with Instagram. Do **not** write a handle the token will immediately replace. Links stay. Metrics keep refreshing. |
| **Account switch** | New Graph id (new / empty media library) | **Blocked** for `active`. Bind latch is `pending_instagram` only. Different IG → `ORG_APPLY_REQUIRED`. | Request + admin approve → re-bind latch + tester re-add + Connect the new Business/Creator account. Old Graph id released. Post policy below. |

Identity key is **`users.instagram_user_id`**. Handle is unique display /
ops (tester add), overwritten from Graph. Posts do **not** store handle or
Graph user id. Autolink matches the **brand** `@` in captions, not the org’s.

There is no admin API to overwrite `instagram_username`. Token clear keeps
Graph ids, so reconnect still targets the old account.

## Motion (locked)

Org (and separately brand — see below) submits a **change request**: current
`@`, requested `@`, and a required explanation (wrong account at apply,
rebrand, lost access / password, etc.).

Admin queue shows previous vs requested handle, the reason, and **risk
context**: accepted applications, linked post count, live vs finished drops.

- **Deny** — no identity write.
- **Approve rename** (same Graph account) — ops notes + “log in with
  Instagram again.” No handwritten `@` write.
- **Approve account switch** — do **not** set `instagram_user_id` from
  the typed `@`. Demote to a re-bind state (reuse `pending_instagram` or a
  dedicated latch), admin re-adds Instagram Tester on the new handle, org
  Connects the new Business/Creator account. Old Graph id is released so
  that account is no longer this user’s login key.

## Post policy on account switch (locked: keep history)

Allowed while they have live drops and past linked posts. Do **not** refuse
the switch just because campaigns are in progress. Do **not** hide old
library rows. Do **not** delete `social_posts` or `post_campaign_links`
(PRODUCT §4.3 KPI preservation / erase analog).

After Connect of account B:

| Surface | Behavior |
| ------- | -------- |
| **Old posts from A** (live or finished drops) | Rows and links **stay**. They do not disappear from the library or from campaign attribution. |
| **Old post metrics** | **Freeze at last successful sync.** Refresh of A’s `external_id` with B’s token fails (`metric_sync` `failed += 1; continue`). Likes, comments, and insight columns are **not written**. They do **not** become 0. Same as today’s deleted/inaccessible-media path. Omitted Graph keys also keep prior DB values (`_apply_basics`). A present Graph `0` would overwrite — account switch should 4xx, not return zeros. Posts older than 30 days are already skipped (already frozen). |
| **New posts from B** | Discovery inserts `/me/media` into the same `org_id` library. Those rows refresh normally. |
| **Campaign totals** | Last-known A + live B. Not a wipe. |
| **Follower count** | Single org field. Daily `/me` refresh **becomes B’s** `followers_count`. Estimated reach follows B. Fail/omit on that call keeps the prior value (today’s follower path). |

Surfaces that show linked posts keep historical KPIs. Show that older posts
are from the previous Instagram account (banner / copy). Mixed library is
accepted; silent metric loss is not.

This is already how `sync_metrics` behaves on fetch failure. The gap is the
request/approve/re-bind path plus making that freeze-not-zero behavior an
explicit product rule after a switch — not a new metrics writer.

## Brand handle is a different, cheaper problem

`brands.instagram_handle` is autolink caption-matching text, **not** login
identity (PRODUCT §3.1.1). Changing it does not move posts. Existing
`post_campaign_links` stay. Future autolink scans use the new `@`.

If brands need a change request too, it can share the admin queue UX
(old / new / reason) without Graph re-bind. Do not put brand handle
edits on the org OAuth path.

## Out of scope / do not

- Self-serve PATCH of `instagramHandle` on `/api/orgs/me`
- Creating a second Buzz user when the org OAuths the new account
- Auto-confirming autolink after a switch
- Treating a typed `@` as proof they own that Graph account
- Zeroing or deleting old posts when refresh fails after a switch
- Refusing a switch solely because a drop is ongoing
- Hiding old posts from the library / finished-campaign history
