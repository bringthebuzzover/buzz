---
id: drop-signup-apply
title: Brand deep link — login or signup, then apply to a specific drop
status: exploring
updated: 2026-09-15
---

# Drop deep link (existing org vs new org)

Brainstorm (2026-09-14). **Not PRODUCT.** Promoting needs an explicit PRODUCT /
UX decision ([`AGENTS.md`](../AGENTS.md) hard stop). Not a gap: apply and
onboarding work as specified today; this is a new acquisition funnel.

Related: [`org-precreate.md`](org-precreate.md) (ops `/org/apply?prefill=` —
not a brand campaign URL). [`org-bind-at-signup.md`](org-bind-at-signup.md)
(later one-click: Instagram is identity at create). PRODUCT today: **§6.1**
access gate, **§6.3.2** / **§7.1** Apply only while Open, no waitlist.

**Sequence (2026-09-15):** this funnel **first**, then bind-at-signup. Bind-at
signup does not replace the brand URL and does not auto-Apply; it only makes
mid-review re-login possible. Keep promote-to-`applied` at `active` in both.

## Desired motion

A brand promotes a drop on Instagram / socials / their site. An org clicks one
URL:

- **Already has a Buzz account:** log in (Instagram) and land on **that** drop,
  then Apply (optional pitch, same as the feed).
- **Does not:** fill org apply **and** the drop pitch in one motion. The drop
  application is **not** a real applicant yet. When account creation is
  **finished**, Buzz auto-submits Apply (`decision=applied`) if the drop is
  still Open.

Admin can see orgs that **intend** to apply but have not finished onboarding
(separate from brand finalize).

## How it fits today

| Piece | As-built |
| ----- | -------- |
| Org account | Public `/org/apply` creates `users` + `organizations` at `pending_email_verification`. Then `.edu` verify → `pending_approval` → admin Approve → `pending_instagram` → Connect → `active`. |
| Drop Apply | `POST /api/drops/{id}/apply` requires `CurrentOrg` (`status=active`). Optional `pitch` only. No custom per-drop questions. |
| Deep link | No public drop route. `/org/browse` is portal-gated. Login / OAuth always land via `pathForUser` (active → `/org/browse`, not a drop id). No `?next=`. |
| Prefill | `org_apply_prefills` is a hashed **pre-account** draft for ops email. No `drop_id`. TTL / one-shot. |
| Real application | `drop_applications` (`applied` / `accepted` / `denied`). Brand finalize, capacity, My Campaigns treat `applied` as a real pending applicant. `org_id` FK required. |
| Interest cousin | `notify_me` is Upcoming reminders for **active** orgs, not apply intent. |

**Hard PRODUCT fork:** §6.1 says Apply requires Instagram bind. “Account
creation finished” is **not** the org-apply form — verify + Buzz review +
Connect often takes **days**. The apply window can close first.

## What to collect (if promoted)

Do **not** invent a shorter signup. Same `/org/apply` fields (§6.1 / §6.1.1):
org name, university, members, type, contact, US shipping, campus `.edu`,
Instagram handle + Business/Creator confirm. Optional TikTok. Plus the existing
**optional pitch** (as-built; not named in §7.1). No second “why apply” field
unless PRODUCT adds drop-specific questions.

## Storage (if promoted)

**Do not** write `decision=applied` early — brands would see unverified orgs.

| Option | Fit |
| ------ | --- |
| `org_apply_prefills.extras` | Wrong after a user exists; no `drop_id`; TTL. |
| New `application_decision` / early `drop_applications` | Pollutes brand finalize unless every consumer filters. |
| Columns on `organizations` (`intent_drop_id`, `intent_pitch`) | No new table; one in-flight drop per org; still a migration + promote hook. |
| New `drop_apply_intents` | Cleanest first-class org↔drop intent; admin queue; promote to `applied` on `active`. |

## Unlocked forks (do not implement until locked)

| Fork | Options |
| ---- | ------- |
| When auto-submit | Only at `active` (matches §6.1) vs earlier (brands see unfinished orgs). |
| Window closed while onboarding | Expire intent (no waitlist) vs email vs other. §7.1 has **no waitlist**. |
| Sequence | Existing-org deep link first vs both paths together. |
| Persistence | `drop_apply_intents` vs org columns. |
| Brand visibility | Admin-only intent queue (recommended) vs brand sees “pending signup”. |

Ship existing-org login→drop first if we slice. New-org intent is the large
piece (combined form, promote-on-active, expiry, admin list).
