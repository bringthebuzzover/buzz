---
id: posts.stories-unsupported
title: Instagram Stories unsupported — skip discover/link; fix admin counter lie
kind: silent_loss
severity: P2
status: fixed
closed_in: e5afd5e
surface: jobs
evidence:
  - path: backend/app/jobs/metric_sync.py
    note: Discovery inserts any media_product_type; refresh already excludes STORY
  - path: backend/app/jobs/autolink_scan.py
    note: Suggestable FEED+REELS only; STORY/AD never suggested
  - path: backend/app/services/posts.py
    note: link_post / list_org_posts have no media_product_type gate
  - path: backend/app/services/admin_read.py
    note: posts_never_refreshed / metric_sync_stale count STORYs with null metrics
  - path: META.md
    note: Instagram Login only — no story_insights webhook path
repro: |
  Insert SocialPost with media_product_type=STORY, metrics_updated_at NULL.
  GET /api/admin/health → posts_never_refreshed / metric_sync_stale inflate.
  Org can still POST …/link-post for that post_id (no type reject).
  (Meta /me/media rarely returns stories; defense-in-depth still required.)
fix_when: |
  Locked v1 below shipped + tests green; admin counters ignore STORY; discovery
  does not insert STORY; link/accept reject STORY; META/ARCHITECTURE note Stories
  out of scope. PRODUCT one-liner only if user asks for PRODUCT edit.
  Existing STORY rows: detect; cleanup only if count > 0 and product OK.
  Non-goals: /stories poller, story_insights webhook, AD refresh skip, enum drop.
---

# Instagram Stories unsupported (v1)

Product decision (2026-08-10): **Stories are out of scope for Buzz v1.** Do not
treat them like FEED/REELS. Harden skip end-to-end; do not build a 24h story
pipeline unless PRODUCT later makes Stories a campaign deliverable.

## Research — Meta / Instagram API (verified)

| Claim | Source |
| ----- | ------ |
| Story **media metrics** only available for **~24 hours** | [Instagram Media Insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/) |
| Live stories via **`GET /{ig-user-id}/stories`**; “Stories are only available for 24 hours” | [IG User Stories](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/stories/) |
| **`GET /{ig-user-id}/media` does not return Story IG Media** — use `/stories` instead | [IG User Media](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/) |
| Post-expiry salvage: **`story_insights` webhook** (~1h after expiry) — **Facebook Login only** | [Webhooks for Instagram](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-instagram/), [Insights overview](https://developers.facebook.com/docs/instagram-platform/insights/) |
| Story metric set ≠ FEED (replies / navigation / link_clicks; no likes/comments/saved as FEED) | Media Insights metric table (same docs) |
| Highlights unreliable for durable REST insights (API / webhook / UI may disagree) | Media Insights “Story media metrics” limitations |

**Buzz auth:** Instagram Login (`graph.instagram.com`, `instagram_business_basic` +
`instagram_business_manage_insights`) per `META.md`. **No** `story_insights`
webhook. Discovery today is **`/me/media` only** — not `/stories`.

**Implication:** A daily discover → refresh-for-30-days job **cannot** keep story
KPIs honest. Refreshing stories would require a separate high-cadence `/stories`
pipeline (+ local persistence). That is explicitly **out of v1 scope**.

## Research — industry pattern

Brand suites (Hootsuite, Buffer, Iconosquare, Metricool, etc.): **capture while
live or lose per-story metrics**; no historic story backfill from Meta API.
Influencer tools often use OAuth capture, mention listening, or screenshots;
Stories are usually **separate** from feed/Reels ROI. ETL connectors treat
Stories as a **sidecar stream**, not part of long-lived media sync.

## How a STORY row can appear in Buzz today

Only production insert path: `metric_sync` discovery → `fetch_media` → insert
whatever `media_product_type` Graph returns (**no STORY filter**).

| Path | Notes |
| ---- | ----- |
| Meta `/me/media` returning a Story | **Documented as unsupported**; should be rare. Still filter (defense in depth). |
| Mislabel / API drift | Possible; filter on `media_product_type == STORY` after `fetch_media`. |
| Tests / manual SQL | CI inserts STORY to prove refresh/autolink skips. |
| Manual link of URL | **Impossible** — link is `post_id` only; no URL ingest. |
| Autolink | Never mints suggestions for STORY. |

So “accidental” = tolerate Graph weirdness, not a product Stories feature. Leaving
rows half-dead (never refreshed, still listable/linkable, inflate admin health)
is the hole.

## AD policy (explicit non-goal for this gap)

| | STORY | AD |
| - | ----- | -- |
| Autolink | Skip | Skip (already) |
| Refresh | Skip (already) | **Keep refreshable** — no evidence AD is 24h-only like Stories |
| Discovery insert | **Skip** (this gap) | Leave alone unless separate decision |
| Admin refresh counters | **Exclude** | Leave in counts (AD is refresh-eligible) |

Do not collapse AD into the STORY skip without a separate ask.

## Current as-built (partial skip)

| Layer | Today |
| ----- | ----- |
| Discovery insert | Inserts STORY if Graph returns it |
| Refresh | Skips STORY |
| Autolink | Skips STORY |
| `list_org_posts` / org linker UI | Shows all types; UI ignores `mediaProductType` |
| `link_post` / `accept_suggestion` | No type reject |
| Brand linked aggregates | Sum all linked posts (no type filter) |
| Admin `posts_never_refreshed` / `metric_sync_stale` | Count STORY null/stale metrics → **ops lie** |
| Enum `STORY` | Keep — do not drop PG enum value |

## Locked v1 fix

### Goals

1. **Never catalog Stories** — skip insert when `media_product_type == STORY`.
2. **Never attribute Stories** — reject `link_post` and `accept_suggestion` for STORY.
3. **Honest admin signals** — exclude STORY from `posts_never_refreshed` and
   `metric_sync_stale`; update admin label notes.
4. **Docs** — `META.md` + `ARCHITECTURE.md` state Stories out of scope / no
   `/stories` sync. PRODUCT one-liner only with explicit user OK.
5. **Tests** for discovery skip, link reject, admin counter exclusion.
6. **Detect** existing STORY rows (SQL below); cleanup only if count > 0.

### Non-goals

- `GET …/stories` poller or hourly cron
- `story_insights` webhook / Facebook Login migration
- Story-specific insight columns or KPI dashboards
- Removing `STORY` from the Postgres enum
- Skipping AD discovery/refresh
- Platform observability stack (Prometheus/Sentry) — stays in
  `ops.observability-thin`

### Implementation sketch

1. **`metric_sync` discovery** — after `fetch_media`, if
   `fields.media_product_type == STORY`: do not insert; optionally increment a
   `skipped_story` counter in the job summary; continue.
2. **Keep refresh STORY exclusion** (already correct).
3. **`link_post` + `accept_suggestion`** — if post is STORY, raise a stable
   client error (reuse or add e.g. `UNSUPPORTED_MEDIA_TYPE` / similar in
   `app/errors.py` + OpenAPI). Defense in depth even if discovery skip lands.
4. **Optional UX:** filter STORY out of `list_org_posts` **or** hide in
   `ApiPostSelector` — nice-to-have; API reject is the gate. Prefer list filter
   so the linker never shows dead rows.
5. **`admin_read`** — add
   `SocialPost.media_product_type != STORY` (or
   `.notin_([STORY])`) to `posts_never_refreshed` and `metric_sync_stale`
   queries. Update `frontend/src/components/admin/labels.ts` notes
   (e.g. “FEED/REELS discovered but never refreshed; Stories are unsupported”).
6. **Docs** — short “Stories unsupported” note in `META.md` (API + 24h + no
   webhook on IG Login) and `ARCHITECTURE.md` (`metric_sync` / `social_posts`).
7. **Data probe (ops, read-only):**

```sql
SELECT count(*) FROM social_posts WHERE media_product_type = 'STORY';

SELECT sp.id, sp.org_id, sp.external_id, sp.metrics_updated_at,
       (pcl.post_id IS NOT NULL) AS linked
FROM social_posts sp
LEFT JOIN post_campaign_links pcl ON pcl.post_id = sp.id
WHERE sp.media_product_type = 'STORY';
```

   - count = 0 → no migration.
   - unlinked only → optional delete in a follow-up commit if desired.
   - linked → unlink/filter from KPIs only with product OK (rare).

### Acceptance checklist

- [x] Discovery fake returning STORY does not insert; job summary reflects skip
- [x] `test_metric_sync_does_not_refresh_story` still passes; add discovery-skip test
- [x] `link_post` (and accept) reject STORY with stable error code + test
- [x] Admin health: STORY null metrics do not inflate the two counters + test
- [x] Admin label copy mentions Stories unsupported / FEED+REELS
- [x] `META.md` + `ARCHITECTURE.md` updated; OpenAPI regen if new error code
- [x] No `/stories` client or webhook added
- [x] AD behavior unchanged (still non-suggestable, still refreshable)

## Related

- `ops.observability-thin` — remaining platform obs (readyz/metrics/logging);
  STORY counter slice **moves here** as Locked v1.
- PRODUCT §5.3.1 UGC lists posts/Reels/photos (Stories omitted by silence) —
  explicit PRODUCT line is a hard-stop ask, not required to ship code skip.
