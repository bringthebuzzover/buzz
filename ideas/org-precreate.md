---
id: org-precreate
title: Pre-create org accounts and invite by email
status: exploring
updated: 2026-08-25
---

# Pre-create organization accounts (email claim + later Instagram)

Brainstorm (2026-08-25). **Not committed behavior.** Promoting this needs an
explicit PRODUCT / UX lock ([`AGENTS.md`](../AGENTS.md) hard stop). Related
ops: [`gaps/deploy.meta-business-verification.md`](../gaps/deploy.meta-business-verification.md)
(public Instagram login still blocked).

## Desired motion

We already have a list of student orgs plus some of the profile fields the
onboarding form collects, and we already have their emails. Goal: **provision
the Buzz account ahead of time** so the org only has to **click a link in that
email**. After the click, the account should be **set up**; the remaining work
is **connect / sync Instagram**.

## What exists today

Org onboarding is **PLG, Instagram-first** ([`PRODUCT.md`](../PRODUCT.md) §1,
§3.1, §6.1):

1. **Login with Instagram** (Business/Creator) **creates or signs into** the
   Buzz user. Instagram **is** the org identity — the handle is not chosen
   separately.
2. Fill profile: university, org name, member count, type, city, state,
   contact name, shipping address, campus **`.edu`**.
3. Verify `.edu` (one-shot token → `/onboarding/verify-email?token=`).
4. Wait for **Buzz admin approval**.
5. Then portal access (`users.status = active`).

There is **no** org invite, magic-link login, or admin “create org” API.
Admins can only list / approve / deny / erase / clear IG token / View as.

**Closest analog:** brand invite. Admin provisions a brand → approval emails
`/brand/setup?token=` → recipient sets a password → session starts. Tables /
code: `brand_invite_tokens`, `create_brand_invite` /
`set_brand_password` in `backend/app/services/brand_auth.py`,
`BrandSetupPage.tsx`.

**Schema luck:** `users.instagram_user_id` (and token columns) are already
**nullable** (orgs get them at OAuth; brands/admins never have them). A
pre-created org user without IG is a data shape the table already allows.
`maybe_refresh_on_login` is a no-op when there is no IG token. The hard part
is **product + OAuth bind**, not a NOT NULL column.

## Hard constraint: click ≠ Instagram connected

An email click **cannot** attach Instagram. Meta OAuth needs the org to be
logged into the **organization’s Business/Creator** account in a browser and
grant Buzz. Follower counts and post library only exist after that token
exists ([`PRODUCT.md`](../PRODUCT.md) §4.3; `metric_sync`).

So “fully set up and connected” after one click can mean **Buzz profile +
session + verified inbox**, not Graph identity. Instagram remains a **second
step**, same family as today’s `/reconnect-instagram`.

**Ops overlay:** until Meta **Advanced Access**, only Instagram Testers can
complete OAuth ([`META.md`](../META.md),
`gaps/deploy.meta-business-verification.md`). Inviting a hundred public
chapters to “just sync IG” will fail for anyone who is not a tester.

## Product forks this would take

| Today (PRODUCT) | Invite motion |
| --- | --- |
| Instagram is account identity at create/login | Account exists **before** IG; IG is bind/sync |
| Self-serve signup | Sales-led / admin-provisioned orgs |
| Org fills profile after IG | Profile pre-filled from our list |
| Separate `.edu` verify, then admin approve | Click can **be** verify; approve can be skipped if we pre-vetted |
| Returning login = Instagram only | Need a path back if they click but have not bound IG yet |

## Options

### A — Claim link, then Connect Instagram (recommended shape)

Mirror brand invite, without a password.

1. Admin (or import) creates `User` (`portal_role=org`) + `Organization` from
   the list. `edu_email` set; `email_verified_at` **unset until click** (or
   set on click). No IG ids yet. New status e.g. `pending_instagram` (or
   reuse `pending_org_profile` with a profile already present — worse).
2. Mint one-shot `org_invite_tokens` (hash-at-rest, TTL, invalidate prior,
   `FOR UPDATE` on redeem — copy brand invite).
3. Email `{FRONTEND_URL}/org/claim?token=…`.
4. Click: consume token, mark email verified, mint session, land on
   **Connect Instagram** (reuse reconnect CTA / OAuth start).
5. IG callback **binds** this user instead of inserting a second user.
   Follower seed + media sync as today. Status → `active` (if we skip
   approval) or `pending_approval`.
6. Later logins: **Login with Instagram** (identity restored). If they never
   bound IG, **resend claim link** is the only way back (unless we add
   magic-link login — extra fork).

**Why this matches the ask:** one click finishes Buzz-side setup; leftover
work is Instagram. Brand invite is the implementation template.

### B — Keep Instagram-first; invite is “start OAuth with prefill”

Do **not** create a `User` until they OAuth. Email is a signed “prospect”
link. Click → Login with Instagram → on callback, attach prefill, skip the
profile form, treat inbox click as `.edu` verify, maybe auto-approve.

**Closer to PRODUCT** (IG still creates the account). **Worse UX vs the
ask:** the click does not finish setup; they must complete Meta OAuth
immediately, with no session if they bounce.

### C — Email magic-link as ongoing org login

Claim token (or a new magic link) is how orgs sign in, with IG only for
metrics/posts.

**Largest identity fork.** Duplicates brand password/invite semantics onto
orgs and fights §3.1. Not needed if A’s “IG after first bind” is enough.

## What the list must contain

Same required onboarding fields (`OrgOnboardingRequest` /
`organizations` + `users.edu_email`):

| Field | Notes |
| --- | --- |
| Org name | Required |
| University | Required |
| Campus `.edu` | Unique; PRODUCT requires `.edu` domain. Non-`.edu` contacts are a separate fork |
| Member count | ≥ 0 |
| Category | Enum: sorority / fraternity / sports / academic / social / other |
| City, state | Required on signup |
| Contact name | Required |
| Shipping address | Required free text today (`org.shipping-address-unverified`) |
| Instagram handle | **Optional hint only.** Cannot log them in or skip OAuth. Soft-match after connect is a UX choice |

Missing required fields → either block import or land them on a short
confirm form (not “one click”). Duplicate `.edu` / already-verified email →
skip or merge. IG already bound to another Buzz user → refuse bind, support
path.

## Backend / SPA work (option A)

- PRODUCT lock: statuses, auto-approve vs still review, `.edu` = click.
- Migration: `org_invite_tokens` (mirror `brand_invite_tokens`); optional
  new `users.status` value.
- Admin: `POST /api/admin/orgs` (single + maybe CSV); resend invite.
- Email: new Resend plain-text body (claim URL, TTL copy).
- Auth: redeem endpoint mints JWT + refresh cookie (like brand set-password).
- IG callback: if session/latch is a pre-created org **without** IG, **update
  that row**; if Graph id already belongs to someone else, 409. Today
  `handle_instagram_callback` only upserts **by IG id** and otherwise
  **inserts** — that would duplicate the invited user.
- SPA: `/org/claim?token=` (strip token from URL); Connect Instagram landing;
  `pathForUser` / `RequireStatus` for the new status.
- Tests: redeem, expiry, double-click, IG bind race, email taken, IG taken.
- OpenAPI regen.

Do **not** reuse `.edu` verification tokens as login: they are not sessions
and today’s verify page is confirm-before-consume, not “you are in.”

## Security

- Whoever can read the inbox **owns** the org (shipping address, later IG
  bind). Same as brand invite to the wrong `company_email`.
- One-shot hashed tokens, short TTL (brand invite is 7 days; verify is 24h —
  pick explicitly; campus officers are slow).
- Do not auto-verify email **before** click (that would mark `.edu` taken
  without proof).
- Confirm-before-consume on the claim page if we want parity with verify-email
  (prefetchers). Brand setup currently consumes on password submit, not on GET.

## Recommendation

Ship **A** if we want sales-led campus seeding; keep public **PLG IG signup**
as a parallel path. Do not implement C. Treat B as a fallback if we refuse to
create users without Instagram.

**Do not build until PRODUCT locks** the questions in the parent chat
(approval, `.edu`, returning login, IG-required-for-portal, import vs admin
UI). Independent of that lock: **Meta Advanced Access** still gates “any org
can connect Instagram.”
