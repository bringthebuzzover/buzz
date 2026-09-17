---
id: drop-signup-apply
title: Brand deep link — login or signup, then apply to a specific drop
status: shipped
updated: 2026-09-17
---

# Drop deep link (existing org vs new org)

Brainstorm (2026-09-14). **Promoted 2026-09-16.** **Shipped 2026-09-17** on
`feat/public-drop-signup` ([PR #6](https://github.com/bringthebuzzover/buzz/pull/6)).
Behavior SOT is [`PRODUCT.md`](../../PRODUCT.md) **§6.3.4** / **§7.1**. This
file is provenance. Do not implement from here.

Related: [`org-precreate.md`](org-precreate.md) (ops `/org/apply?prefill=` —
not a brand campaign URL). [`../org-bind-at-signup.md`](../org-bind-at-signup.md)
(later one-click: Instagram is identity at create — **not** shipped). PRODUCT:
**§6.1** access gate, **§6.3.2** / **§7.1** Apply only while Open, no waitlist.

**Sequence (2026-09-15):** this funnel **first**, then bind-at-signup. Bind-at
signup does not replace the brand URL and does not auto-Apply; it only makes
mid-review re-login possible. Keep promote-to-`applied` at `active` in both.

## Desired motion

Each published, unhidden drop has a **public page** (brand-shareable URL).
Drop info is always visible. Apply lives **on that same page**:

- **Logged in, `active`:** regular Apply (optional pitch). Immediate
  `decision=applied`.
- **Logged out / no account:** same §6.1 / §6.1.1 profile fields as
  `/org/apply` plus optional pitch. Submit creates the org and stores
  **intent** — not a real applicant. Honest CTA (not “you’re applied”).
- **Logged in, still onboarding:** no second signup form. Copy: we’ll submit
  when the account is live. Pitch editable on the intent.
- **Already applied:** same as the feed.

When they become **`active`**, auto-submit Apply if the drop is still Open.
Window closed during onboarding → **expire the intent** (no waitlist, §7.1)
but **keep the row for admin**. Brands never see intent. Upcoming/Closed:
show the drop, hide Apply (Upcoming Notify Me stays active-org only).
Standalone `/org/apply` stays for join-without-a-drop.

## Locks (2026-09-16)

| Fork | Lock |
| ---- | ---- |
| Surface | One public drop page; form mode follows auth. |
| Auto-submit | Only at `active`. |
| Window closed while onboarding | Expire intent; still visible to admin. |
| Brand visibility | Admin only (on the drop). |
| Persistence | `drop_apply_intents`. |
| Signup fields | Full `/org/apply` — do not shorten. |

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

## Endpoints (if promoted)

Reuse `apply_org`, `apply_to_drop`, browsable-drop checks, IG lookup, address
suggest. **Do not** write `drop_applications` until promote. **Do not** stuff
intent into `org_apply_prefills`.

| Need | Shape |
| ---- | ----- |
| Public drop read | Same `GET /api/drops/{id}` with optional auth (404/DROP_NOT_OPEN if hidden/draft/finished). Omit personal fields when anonymous. |
| Logged-out submit | Extend `POST /api/orgs/apply` with optional `dropId` + `pitch` → `apply_org` + intent row. |
| Logged-in apply | Existing `POST /api/drops/{id}/apply`. |
| Mid-onboarding pitch | Small authenticated (not `CurrentOrg`) upsert on the intent. |
| Promote | Internal: `apply_to_drop` from Connect→`active` (and Approve skip-Connect). If not Open, mark expired. |
| Admin | Add intents (open + expired) on existing `GET /api/admin/drops/{id}`. |
| Login return | OAuth `state` `next` back to the public drop URL (callback today hardcodes `/org/browse`). |

Later [`../org-bind-at-signup.md`](../org-bind-at-signup.md): public GET + intent
table + promote-on-`active` stay. Create path moves to draft→OAuth INSERT;
promote hook also runs on Approve→`active`. `/login` still does not insert.
