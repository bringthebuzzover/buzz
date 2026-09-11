---
id: admin.brand-erase
title: Admin has no brand erase; only org hybrid erase exists
kind: ops
severity: P2
status: open
surface: admin
evidence:
  - path: backend/app/services/admin_erase.py
    note: Only erase_org_user; scrubs org PII, keeps applications/links/metrics
  - path: backend/app/routes/admin.py
    note: POST /api/admin/orgs/{user_id}/erase exists; no brands/{id}/erase
  - path: frontend/src/pages/admin/AdminBrandDetailPage.tsx
    note: Approve/deny/resend/View as only — no erase control
  - path: PRODUCT.md
    note: §3.1.2 is org-only; v1 explicitly "no brand-portal erase"
  - path: backend/app/models/drop.py
    note: drops.brand_id FK has no ON DELETE; hard-delete of a brand with drops fails or would orphan campaign history
  - path: backend/app/services/admin.py
    note: deny_brand is onboarding deny (pending_review only), not identity wipe
repro: |
  Open /admin/brands/:id on an approved brand. There is no erase/trash control.
  grep -n erase backend/app/routes/admin.py shows only orgs/{user_id}/erase.
  A brand data-deletion mailto on /data-deletion has no admin fulfillment path.
fix_when: |
  PRODUCT names brand erase (amend §3.1.2 or add §3.1.3) instead of "v1 no
  brand erase". Admin brand detail has a confirm-gated hybrid erase. Drops,
  applications, post_campaign_links, and numeric metrics are not deleted.
  Brand PII and login are scrubbed; sessions revoked. Org My Campaigns /
  attribution still resolve (tombstone brand name). Unique company_email can
  be reused. Tests cover live drops + accepted orgs. Do not archive on a
  hard-delete of brands/drops.
---

# Admin brand erase (investigation, not a locked design)

There is **no** brand analog of org hybrid erase today. Deny-brand is a
different machine (pending_review → denied). Shipping this needs a **PRODUCT
decision** — §3.1.2 currently forbids brand-portal erase in v1. This file
records the ops hole and the investigation so a later implementation does not
invent a cascade-delete.

**Do not implement until PRODUCT locks the questions at the bottom.** The
preferred shape below is a recommendation, not a cluster lock.

## Side by side (as-built org vs recommended brand)

| | **Org erase (shipped)** | **Brand erase (does not exist)** |
| | --- | --- |
| Trigger | Admin org detail, type IG handle | Would be admin brand detail; confirm string TBD (company email is the stable unique, not IG) |
| Identity rows | `users` + `organizations` **kept**, scrubbed | `users` + `brands` **should be kept**, scrubbed. `brands.user_id` ON DELETE CASCADE from `users` — do **not** delete the user |
| Login | IG ids/token/username, `.edu`, password null; `status=erased`; `token_version` bump | Password hash null; bump `token_version`; need `brands.status=erased` (**enum does not have it**). Brand `users.status` today tracks approve/deny, not `erased` |
| Profile PII | Name → `Deleted organization`; wipe shipping/contact/tiktok/category/city; **keep** `university`, `follower_count` | Name → tombstone (e.g. `Deleted brand`); wipe `company_email`, `intent_message`, `instagram_handle`. Unique index `uq_brands_company_email_lower` means the old email must be freed (sentinel `erased+{uuid}@…` or similar) so a new apply can reuse it |
| Campaign graph | **Kept:** `drop_applications` (accepted seats), `post_campaign_links`, `social_posts` (permalinks/captions/media anonymized), numeric insights | **Must keep:** `drops`, `drop_applications`, `post_campaign_links`, org `social_posts` + metrics, `drop_tracker_events`. Posts are **org-owned**, not brand-owned |
| Extra deletes | `notify_me`, `post_campaign_suggestions`, email/password tokens; auto-deny still-`applied` apps | `brand_invite_tokens`; unpublished tickets (`drop_requests`) can be closed/scrubbed. Do **not** delete applications or links |
| Email | Best-effort confirmation to `.edu` | Best-effort to `company_email` **before** it is wiped |
| Consumer UX | Brand/admin see tombstone org + campus | Org feed / My Campaigns still join `brands.brand_name` — would show tombstone. Live browse of that brand's **open** drops is a PRODUCT fork (hide vs leave up) |

### What org erase deliberately does **not** delete

From `admin_erase.py`: organization row, user row, accepted (and denied)
applications, `post_campaign_links` (comment: kept for §4.3), `social_posts`
rows (content fields scrubbed). Pending `applied` apps are **denied**, not
removed.

### What a naive brand DELETE would destroy

- `drops.brand_id` → `brands.id` is **NOT NULL** and has **no `ON DELETE`**.
  Deleting `brands` with drops present is a FK violation (Postgres NO ACTION).
- Forcing a cascade would delete drops → applications → (if cascaded) links,
  wiping **org** campaign history and §4.2 attribution. That is the unsafe
  path.
- `drop_requests.brand_id` same pattern.
- Org rows that **partook** in those drops are not children of `brands`; they
  survive a brand delete, but their `drop_applications` would die if drops
  died. Org My Campaigns / campaign detail would 404 or empty.

## Attribution and participating orgs

- Attribution SOT is `post_campaign_links` → `drop_applications` → `drops` +
  `social_posts` (org). Brand erase must not break that chain.
- §4.3 KPI preservation is written for **org** erase (brand dashboards keep
  numbers). The inverse still applies: **org** dashboards must keep their
  participation record if the brand later erases.
- Follower/reach numbers live on **organizations**, not brands. Brand erase
  does not need to touch them.
- Auto-link scan keys off `brands.instagram_handle` and drop hashtags.
  Clearing the handle is correct (no new matches). Existing links stay.

## Options (brainstorm)

**A. Hybrid tombstone (recommended, parallel to org)**  
Keep brand + all drops + applications + links. Scrub PII, revoke login, new
`erased` brand status. Optionally **hide** published drops from org browse
(`hidden_at`) so the marketplace does not advertise a dead brand, while My
Campaigns for already-accepted orgs still works. Unpublished drafts with
zero applications could be unpublished-only deleted or left as tombstone
drops.

**B. Hard-delete brand with no campaign history**  
Only safe if `drops` count is 0 (and maybe no `drop_requests`). Too narrow
for a data-deletion request after any live campaign.

**C. Reassign drops to a Buzz-owned holding brand**  
Preserves FKs but rewrites campaign ownership; worse for audit than A.

**D. Do nothing (current PRODUCT v1)**  
Ops cannot fulfill a brand `/data-deletion` request except manual SQL.
Deny-brand does not wipe email/name/password.

Prefer **A**. Reject cascade-delete of drops.

## PRODUCT questions (hard stop)

1. Amend §3.1.2 / add brand erase, or keep v1 “no brand erase”?
2. Confirm phrase: company email (unique, always present) vs brand name
   (can collide)?
3. Live org feed: hide this brand's published drops, or leave them with a
   tombstone name?
4. May the same `company_email` apply again after erase?
5. Self-serve brand delete vs admin-only (org is admin-only after mailto)?

Until those are answered, do not add a trash control on brand detail that
implies a wipe.

## Related

- Org erase: `gaps/archive/product.data-deletion-overpromise.md`
- Hide published drop (consumer unlink, keep admin row): PRODUCT §5.2.2 —
  useful **tool** for (3), not a substitute for identity wipe
- `/data-deletion` copy is role-agnostic; fulfillment exists only for orgs
