---
id: org-bind-at-signup
title: Bind Instagram at org signup; waitlist until review
status: exploring
updated: 2026-09-15
---

# Bind Instagram at org signup (waitlist until admin)

Brainstorm (2026-09-14; saved 2026-09-15). **Not PRODUCT.** Promoting needs an
explicit PRODUCT / UX decision ([`AGENTS.md`](../AGENTS.md) hard stop). Not a
gap: apply-first + Connect-after-Approve works as specified today; this is a
new signup motion.

Related: [`org-precreate.md`](org-precreate.md) (opposite sequence: apply first,
IG last — that **shipped** via LAUNCH Phase A). [`archive/drop-signup-apply.md`](archive/drop-signup-apply.md)
(brand deep link → apply — **shipped**; “account creation finished” is still
**admin Approve**, not the signup form). Meta: [`META.md`](../META.md),
[`gaps/deploy.meta-business-verification.md`](../gaps/deploy.meta-business-verification.md).

**Sequence (2026-09-15):** implement [`archive/drop-signup-apply.md`](archive/drop-signup-apply.md)
**first** (shipped). This file is the later one-click identity change. Keep the
deep-link intent table and promote-on-`active` rule so the two stay cohesive.

**Locks from brainstorm (2026-09-14):**

- Instagram **OAuth is the identity** at create. No typed handle, no §6.1.1
  confirm card. Graph fills `users.instagram_username`.
- Email verify **does not** block the waitlist (or re-login).
- Email verify **does** block admin **Approve** (feed stays closed until
  confirmed `.edu` **and** review).
- Admin review **stays**. They do **not** land on the Drop Feed after signup.

---

## Desired motion

One sitting creates a real Buzz org that can **log back in with Instagram**.
The home screen is **waiting for review**, not `/org/browse`.

1. Public `/org/apply` — same profile fields as today **except Instagram
   handle**: university, org name, member count, organization type, contact
   name, US shipping (provider-verified), campus `.edu`. Optional typed
   TikTok stays optional. Primary CTA is **Continue with Instagram** (org
   Business/Creator account, not a member’s personal profile).
2. Meta OAuth succeeds → insert `User` + `Organization`, bind Graph ids /
   token / `@` from Graph, follower seed + media sync as today’s Connect,
   mint session, send `.edu` verify mail. Status → **`pending_approval`**
   even if `email_verified_at` is still null.
3. Land on the waiting screen (evolve today’s `/onboarding/pending-approval`).
   Copy is “we’re reviewing you,” **not** “we’ll email when Instagram is
   ready.” Banner: confirm school email (listed address + resend). Confirming
   `.edu` does **not** change status and does **not** open the feed.
4. **Returning login** is Login with Instagram on that bound account. Unknown
   Instagram on `/login` still does **not** insert — send them to `/org/apply`.
5. Admin reviews. **Approve** is allowed only when `.edu` is verified **and**
   Graph is bound. Approve → **`active`** (skip `pending_instagram` / Connect
   email). Deny → `denied` + email; returning IG login stays blocked.

Portal APIs (`CurrentOrg`) and `RequireStatus` stay **`active` only**. Waitlist
is not the feed, not Apply, not Notify Me, not My Campaigns.

---

## Why (vs today)

Today’s wait room already exists. The hole is **re-entry**: `pending_approval`
has no Graph bind, so a lost session cannot use `/login`. PRODUCT §3.1: they
wait for the approval email; there is no connect link to resend.

Bind-at-create makes Instagram the login identity from minute one. Review
still owns **access**. `.edu` stays campus proof for **Approve**, not a door
on the waiting page.

This is **not** org-precreate (admin provisions, IG later) and **not**
dropping review.

---

## How it fits today

| Piece | As-built |
| ----- | -------- |
| Create | `POST /api/orgs/apply` inserts org at `pending_email_verification`, **claimed** `@`, no token, **no session**. |
| IG on apply | §6.1.1 typed handle + Business Discovery confirm card. OAuth does **not** create. |
| Verify | Confirm link → `pending_approval`, **mints session**. Unverified = no session (apply-first). |
| Wait | `/onboarding/pending-approval` (AuthShell). Copy assumes Connect is still ahead. |
| Login | `/login` Continue with Instagram. Unknown Graph id → `ORG_APPLY_REQUIRED` (no INSERT). Returning `pending_approval` **cannot** match — no `instagram_user_id`. |
| Callback | Bind only if `pending_instagram`; else refresh existing Graph id; **does not** promote `pending_approval` → `active`. |
| Approve | Tester-confirm required. If Graph ids+token already on file → `active` (legacy skip-Connect). Else → `pending_instagram` + connect email. |
| Feed | `CurrentOrg` / `RequireStatus` = `active` only. |
| Meta | Standard Access. Privileges empty; `business_verification_passes: false` (2026-09-14). Non-testers fail OAuth. |

Approve’s skip-Connect branch is the intended **happy path** under this idea,
not a legacy leftover.

---

## Status machine (proposed)

| Status | Meaning | Login | Screen |
| ------ | ------- | ----- | ------ |
| *(no user)* | Draft only, or never applied | `/login` → apply | — |
| `pending_approval` | Bound IG; review queue. May be unverified | Instagram | Waiting for review + email banner if needed |
| `active` | Approved **and** `.edu` verified | Instagram | Drop Feed |
| `denied` / `erased` | Unchanged | Blocked / `/login` | Denied page if they still have a session |

**Drop from the happy path:** `pending_email_verification` as a separate
waiting status; `pending_instagram` after first Approve.

**Keep:** `pending_instagram` for **§3.1.4 account switch** (demote, new
Connect). `pending_org_profile` stays drain-only.

`email_verified_at` is **not** a router. It is an Approve predicate + waitlist
banner. `pathForUser(pending_approval)` → waiting screen whether or not the
inbox is confirmed.

---

## Apply sitting (proposed UX)

**One page.** Not IG-first-then-profile (`pending_org_profile`). Not a typed
`@` then a later Connect email.

- Fields: today’s apply **minus** Instagram handle / confirm card.
- Submit = validate + stash a **short-lived draft** + Meta redirect.
- Callback with a valid draft id in OAuth state: **INSERT** user+org and bind.
- `/login` OAuth **without** a draft: still `ORG_APPLY_REQUIRED`. This is a
  **controlled** insert, not “any Graph id creates a user.”

Personal / non-professional Graph account: same `INSTAGRAM_PERSONAL_ACCOUNT`
rejection as now; draft remains so they can convert and retry.

Graph `@` unique among non-erased orgs (same uniqueness as claimed handle
today). Collision → 409; do not insert.

**`/for-orgs`:** Phase C currently must show the handle confirm card. This
idea replaces that with Business/Creator + Continue with Instagram (no
typeahead, no Discovery card).

Prefill (`/org/apply?prefill=`) still fills profile + `.edu`; it does **not**
create the user; they still finish with OAuth. Handle on prefill rows becomes
unused (or ops-only sidecar for tester add — see overlay).

---

## Email

- Send verify at bind (create), not as a session gate.
- Waitlist lists the `.edu` on file + resend (authenticated; they can IG-login).
- **Typo before first verify:** allow change on the waitlist (today’s
  `POST /api/auth/verify-email/change` is API-only and tied to
  `pending_email_verification`). Wrong inbox + Approve-requires-verify would
  otherwise trap them.
- **After first verify:** pending-swap rotate stays as today (`pending_approval`
  already eligible). Does not demote, does not block waitlist.
- **Do not** 24h-release an unverified `.edu` if the user already has a Graph
  bind (today’s abandoned-claim takeover). Instagram is the live identity;
  `.edu` is a pending contact latch until confirm.
- Transactional mail besides verify: still that `.edu`. Mistype risk is why
  Approve waits on confirm — campaign/approval mail should not go to a guessed
  inbox as the *reason they get in*, but ops still emails that address.

---

## Admin

- Queue: `pending_approval` as today, plus **unverified** badge when
  `email_verified_at` is null.
- Approve **disabled** until verified `.edu` **and** Graph ids/token present.
- Tester-invite checkbox is wrong once bind already happened. Replace with a
  review confirm (“I reviewed this org”), or drop it after Advanced Access.
- Approval email: feed is open / sign in at `/login`. **No** Connect CTA on
  first approve.
- View as: still not a portal until `active` (wait screen is not impersonation
  value). Unchanged unless PRODUCT later wants View as → waiting page.
- Deny: unchanged. Bound IG must not mint a fresh session (already tested).

---

## Waiting screen

Evolve AuthShell `/onboarding/pending-approval` (poll `/me`, auto-forward on
Approve/Deny). Working copy: **Waiting for review** — not “Waitlist.”

`ideas/archive/drop-signup-apply.md` uses “waitlist” for **drop apply-window**
behavior PRODUCT §7.1 does not have. Do not reuse that word here.

Not in v1 of this idea: org chrome with Feed/Apply visible-but-disabled.
Waitlist is not a peek at drops.

---

## Current-stage overlay (Meta Standard Access)

Public Continue with Instagram **fails** for non-testers until Business
Verification + App Review → Advanced Access (`instagram_business_basic` +
`instagram_business_manage_insights`).

Without a typed handle, ops **cannot** add Instagram Testers from the apply
form. Tester add has to happen **before** the org can finish signup (list /
prefill sidecar), or this motion waits on Advanced Access.

**Do not ship this as the public create path while Standard Access lasts.**
That recreates archived `org.signup-instagram-first`: bounce on the first
click, no account.

Until Advanced Access, keep **apply-first + Connect after Approve** (PRODUCT
§6.1 / LAUNCH Phase A) for the public internet. This file is the **target**
motion after public IG login works. Optional seeded slice (testers already on
the app): same one-page apply, OAuth succeeds, waitlist, Approve skip-Connect.

No dual-path form (save claimed-handle apply if OAuth fails) unless PRODUCT
explicitly wants two products on one page.

---

## vs drop-signup-apply

Bind-at-signup **does not** make a brand deep link auto-Apply. `CurrentOrg`
is still `active`. Review can take days; the drop window can still close.

`archive/drop-signup-apply.md` should keep: promote intent → `decision=applied` only
at `active`. This idea only makes **re-login** possible during the wait, so
an existing-org deep link can say “you’re still under review” instead of
`ORG_APPLY_REQUIRED`.

---

## Backend / SPA sketch (if promoted)

- PRODUCT §1 / §3.1 / §6.1 / §6.1.1 / §9 / §10: create = form + OAuth bind;
  waitlist; Approve needs verify; returning login from bind; Discovery card
  out; `/for-orgs` tour; Join CTA still `/org/apply`.
- Apply draft table or reuse `org_apply_prefills`-like row with TTL; OAuth
  state carries `draft_id`, not the full form. Consume on successful INSERT.
- `handle_instagram_callback`: INSERT only with valid unused draft; never on
  bare `/login`. Do not promote `pending_approval` → `active`.
- `apply_org` as “create user immediately” goes away (or becomes draft-only).
- `approve_org`: require `email_verified_at`; require bind; always skip
  Connect on this path; drop tester checkbox (or gate on “already bound”).
- Unverified-claim takeover: exclude rows with `instagram_user_id` set.
- Wait page: email banner + change + resend; rotate after first verify;
  drop Connect-ready copy.
- `pathForUser`: unverified bound orgs → waiting screen, not
  `/onboarding/verify-email` as the only home.
- Tests: draft→callback insert; `/login` still no insert; pending_approval
  IG login stays pending_approval; Approve blocked if unverified; Approve
  skip-Connect when bound+verified; deny; handle taken; personal account;
  `.edu` takeover must not steal a bound org.
- OpenAPI regen. E2E join spec rewritten (no confirm card; OAuth fake).

---

## Unlocked (leave unless PRODUCT says)

| Fork | Default in this file | Other option |
| ---- | -------------------- | ------------ |
| Wait chrome | AuthShell waiting page | Org shell, Feed hidden |
| Until Advanced Access | Keep public apply-first | Replace now (tester-only public) |
| OAuth bounce | Keep draft, retry | No draft (retype form) |
| Draft TTL | 24h (match verify) | 7d (match connect tokens) |
| Waiting title | “Waiting for review” | Other copy (not drop-“waitlist”) |
| View as waitlisted orgs | Off | Impersonate waiting page |

Do **not** unlock: feed before Approve; Approve without verified `.edu`;
OAuth insert from `/login`; magic-link as ongoing org login; dropping admin
review.

---

## Recommendation

Promote only **after** (or explicitly as) Advanced Access, unless the slice
is tester-seeded. The PRODUCT fork is real but small: **identity at create,
access at Approve, `.edu` as Approve proof.** Most machinery already exists
(waiting page, skip-Connect, IG login does not promote `pending_approval`).
The new work is apply-draft → controlled INSERT, dropping §6.1.1, and
decoupling `pending_approval` from “already verified.”
