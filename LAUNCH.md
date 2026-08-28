# Seeded launch revamp — implementation plan

**Status:** Phases A–C shipped (2026-08-28). Locks below still apply; do not reopen.  
**Not** an idea file. **Not** a gap list. **Not** a second PRODUCT.

| This file | [`PRODUCT.md`](PRODUCT.md) | [`ARCHITECTURE.md`](ARCHITECTURE.md) | [`gaps/`](gaps/) |
| --------- | -------------------------- | ------------------------------------- | ---------------- |
| Sequence, locks, current vs target, phases | Intended behavior after this revamp | As-built until each phase lands | One hole per file; archive when that hole is gone |

Agents implement **phase by phase** from here. Do not invent a parallel tracker. Do not implement OUT items. PRODUCT forks listed below are **locked** — do not re-ask unless the user reverses a lock.

---

## 1. Launch shape

A **seeded** launch: known campus orgs + sales-led brands. Public Instagram login for *any* campus org (Meta Advanced Access) is **out**. Meta Business Verification is **out**.

**Org:** fill the website form first (profile + `.edu` + claimed `@handle`) → verify school email → Buzz reviews and adds that handle as an Instagram Tester → approval email → they accept the tester invite → Connect Instagram **binds** the existing Buzz user → portal.

**Brand:** Plan your Campaign is a talk-to-Buzz ticket, not a campaign. After the sales call, a Buzz admin **creates** a fully configured drop. The brand monitors and batch-finalizes. Orgs never see placeholders.

**DoD (this revamp is done when):**

1. A non-tester org can create a Buzz account **without** Instagram OAuth.
2. After ops adds them as a tester and an admin approves, they can bind IG and reach `/org/browse`.
3. Unknown Instagram logins do **not** mint a second org user.
4. Org feed / Apply / Notify Me only show admin-created drops (no placehold.co stubs, no fake windows).
5. `.edu` verify mail is HTML + locked copy + Junk hint (campus Outlook).
6. PRODUCT §§ 1 / 3.1 / 5.2 / 6.1 match the flows below (already rewritten as part of this lock).

Public contact mailbox (`ops.brand-mailbox`) is **ops-parallel**, not a code gate. Tours (`/for-orgs`, `/for-brands`) ship **after** 1–4 so they do not teach the old motion.

---

## 2. Locks (former forks — do not reopen)

### Org

| Fork | Lock |
| ---- | ---- |
| Intake | **Public** `/org/apply` (brand-apply analog). No admin CSV in this revamp. |
| Identity until bind | `.edu` is the account. Claimed `@handle` is ops data, not login. |
| Review | Still Buzz admin approve/deny. No auto-approve. |
| Tester | Ops **sends** the Instagram Tester invite in Meta **before** Approve (honor-system confirm). Approval email: **accept the tester invite, then Connect**. Connect is expected to fail until they accept. |
| Emails | (1) verify `.edu` (2) **one** approval email = approved + accept tester invite + Connect link. No extra “tester ready” mail. |
| After approve, before bind | New status `pending_instagram`. **Not** `active`. No Drop Feed / Apply until bind. |
| Connect | `/onboarding/connect-instagram`. Approval email one-shot token mints session if the cookie is dead. |
| OAuth bind | Callback **updates** this user. Graph id already owned → 409. **No session / unknown IG → do not insert** (`ORG_APPLY_REQUIRED`). |
| Returning login after bind | **Continue with Instagram only** (`/login`). No org password. No magic-link as ongoing login. |
| Claimed handle | Unique among non-erased orgs (case-insensitive, `@` stripped). **Denied** orgs keep the handle until **erase**. **Apply UX:** same-page inline **confirm card** after exact-username lookup (§6.1.1) — not a separate route; not an IG-app typeahead. |
| Graph `@` ≠ claimed `@` at Connect | **Allow** bind; overwrite `instagram_username` from Graph; **log** for ops. |
| `.edu` rotate while `pending_instagram` | **Yes** (same pending-swap as `pending_approval` / `active`). |
| View-as while `pending_instagram` | **No** — nothing to impersonate until bind. |
| Legacy IG at Approve | If Graph ids/token already on file → **`active`** (skip Connect). Else → `pending_instagram`. |
| Lost session `pending_approval` | Wait for approval email only (no connect link exists yet). |
| Resend `.edu` verify (no session) | **Public** `POST` (email + rate-limit) after apply. |
| Legacy mid-flight | Existing `pending_org_profile` users may finish the old profile form. **New** IG-first inserts are off. |
| Portal before IG | No. Apply / posts / Graph followers require bind. |

### Brand / drops

| Fork | Lock |
| ---- | ---- |
| Request vs drop | **Two objects.** Ticket (`drop_requests`) is “request received.” A **new** `drops` row is what admin drafts and publishes. `request_received` is **not** a drop tracker stage. |
| Intake vs creative | Ticket message/notes are **reference only**. They do **not** become title/description. Admin writes creative on the drop. |
| Admin UX | Ticket detail: **side-by-side** ticket | draft-drop editor. Save draft; **Publish** is a separate action. |
| Who writes creative | **Admin** on the draft (title, description, location, **https** image URL). Brand does **not** get a creative editor in this revamp. |
| Image URL | **https only.** Reject blank, `http:`, `data:`, `javascript:`, `placehold.co`. No relative URLs. |
| Publish | Unpublished draft: not on org feed, no Notify Me, no autoclose, brand tracker does not run. **Publish** sets `published_at`; orgs see Upcoming/Open from the real window; tracker starts; brand gets monitor email. |
| Brand sees draft | **Yes** — logged-in brand sees unpublished drafts (not org-visible). Ticket + draft on brand surfaces. |
| Ticket required | **Every** `drops` row links to a `drop_requests` ticket. No admin create without a ticket. |
| Tracker after publish | Three stages: `awaiting_products` → `drop_active` → `drop_finished`. No `request_received` or `finalizing_agreements` on drops. |
| Brand link | `{FRONTEND_URL}/brand/drops/{id}` after **publish** (logged-in). No guest token. |
| Legacy stubs | Hide unpublished **and** leftover `request_received` drops from the org feed until ops cleans them. |
| Autoclose | Only **published** drops. Never tickets. Never unpublished drafts. |

### Meta / ops

| Fork | Lock |
| ---- | ---- |
| Business Verification | **Not this revamp.** Keep `deploy.meta-business-verification` parked. |
| App Review | **Not this revamp.** |
| Mailbox | Parallel ops. Reply-To on app mail can stay Cornell until cutover. From on verify mail flips to `hello@` in Phase A. |

### Locked decisions (2026-08-25 — do not reopen)

All former “remaining questions” are closed. Implement from the locks above and §§4–5.

---

## 3. Reconciliation — every living gap and idea

### In this revamp

| Id | Role | Phase |
| -- | ---- | ----- |
| [`org.signup-instagram-first`](gaps/org.signup-instagram-first.md) | New hole vs locked PRODUCT: signup is IG-first, non-testers bounce | A |
| [`ideas/org-precreate.md`](ideas/org-precreate.md) | Motion (public-form variant). Locks live **here**, not in the idea file | A |
| [`org.edu-verify-outlook-junk`](gaps/org.edu-verify-outlook-junk.md) | Verify mail must land in campus Outlook | A (same email.py pass) |
| [`drops.unconfigured-request-on-org-feed`](gaps/drops.unconfigured-request-on-org-feed.md) | Stub campaigns on the org feed | B |
| [`ideas/admin-drops.md`](ideas/admin-drops.md) | Option B. Remaining forks locked **here** | B |
| [`spa.for-orgs-for-brands`](gaps/spa.for-orgs-for-brands.md) | Honest tours of the **new** motions | C (after A+B) |
| [`ops.brand-mailbox`](gaps/ops.brand-mailbox.md) | Company inbox; human Workspace | Ops-parallel |

### After this revamp (Want — do not pull in)

| Id | Why wait |
| -- | -------- |
| `auth.revoked-access-skips-refresh` | Session 401 after tab/View-as. Reload works. Not the loop. |
| `auth.ci-session-restore-flake` | E2E/CI wait-for-restore. Not the user loop. |
| `org.shipping-address-unverified` | Still required free text. Hand-check ship-to for the seeded list. Vendor still unlocked. |
| `brand.drop-creative-uneditable` | Admin writes creative at mint. Brand typo-fix is a later Want. |
| `ops.email-ledger` | PRODUCT still email-only for drop denials. |
| `ideas/paper-ui.md` | Visual workshop. Not the loop. |

### Out (do not implement)

| Id | Why |
| -- | --- |
| `deploy.meta-business-verification` | Testers do not need BV. |
| `spa.csp-blocks-gh-pages-inline` | Archived (fixed). |
| `ops.observability-thin` | One replica is enough. |
| `deploy.npm-workspaces-wontfix` | Decision record. |
| `posts.sibling-dismiss-never-rearms` | PRODUCT accept. |
| `ideas/org-social-accounts.md` | IG-only loop. Typed TikTok handle stays optional on the form. |
| `ideas/ai.md` / `pricing.md` / `markets.md` | Post-PMF. Invoice brands out of band. |

### Contradictions closed

1. **PRODUCT IG-first vs tester wall** → apply-first, IG bind last. `/login` is returning + Connect, not create.
2. **org-precreate admin-CSV vs “fill out on the website”** → public `/org/apply`.
3. **Two connect emails vs one approval email** → one approval email; ops adds tester **before** Approve.
4. **Approve → `active` vs Connect** → `pending_instagram` in between so CurrentOrg cannot Apply without Graph.
5. **admin-drops “Buzz writes creative” vs brand creative PATCH** → admin mint + admin PATCH only. Brand editor out.
6. **`spa.for-orgs-for-brands` “don’t teach precreate”** → precreate **is** PRODUCT; tours teach it after A+B.
7. **Ticket vs live campaign** → request is a ticket; drop is a new row; **Publish** is what orgs see. Do not hide-by-`request_received` as the product rule for new drops.
8. **Verify `hello@` vs mailbox not live** → From can be `hello@` (Resend) while Reply-To stays Cornell. Receiving on apex still waits on Workspace.

---

## 4. Org motion

### Current (as-built)

```
Home Join → /login → Continue with Instagram
  → Meta OAuth (fails unless Instagram Tester)
  → INSERT users (org, pending_org_profile) + IG token
  → /onboarding/profile (no typed handle; Graph username already set)
  → POST /api/orgs/me/onboarding → pending_email_verification
  → .edu mail (text, noreply@, generic “your organization”)
  → confirm token → pending_approval
  → admin Approve → active + email “sign in at /login”
  → /org/browse
```

Evidence: `handle_instagram_callback` inserts on unknown IG; `submit_org_onboarding` requires `require_instagram_handle`; `approve_org` sets `active`; Join CTA is `/login`.

### Target

```
Home Join → /org/apply  (public, no session)
  → Instagram handle: type → debounced lookup → **same-page confirm card**
       (Business/Creator required; not personal; not a typeahead)
  → POST /api/orgs/apply
       User (org, pending_email_verification, NO ig ids)
       Organization (full profile)
       users.instagram_username = claimed handle (no token)
  → .edu verify mail (Phase A copy/HTML/From)
  → /onboarding/verify-email?token=  confirm
       mint JWT + refresh cookie
       status → pending_approval
  → /onboarding/pending-approval
       “We’re reviewing {org}. We’ll email when Instagram is ready.
        Campus inboxes often file first Buzz mail in Junk.”
       No Connect button.

Admin org detail:
  claimed @handle prominent
  Approve confirm: “I added @{handle} as Instagram Tester in Meta App roles.”
  Approve → pending_instagram (NOT active)
  email: approved + accept tester invite + connect URL

/onboarding/connect-instagram
  Copy: Business/Creator account (the org’s, not a member’s).
        Accept tester invite first (instagram.com/accounts/manage_access/).
  Continue with Instagram → OAuth state=bind:{user_id}
  callback UPDATES this user (token, graph ids, username from Graph)
  follower seed + media sync as today
  status → active → /org/browse
```

**Returning after bind:** `/login` Continue with Instagram (existing user by `instagram_user_id`).

**Lost session before bind:** approval / connect email one-shot token (`org_connect_tokens`, hash-at-rest, TTL 7 days, invalidate prior) → mint session → connect page. Public “resend connect link” is **out** (admin resend on org detail).

**Denied:** unchanged (`denied` + email). No Connect.

**IG-first for a brand-new Graph user:** callback 400 `ORG_APPLY_REQUIRED` + SPA message with link to `/org/apply`.

### Status machine (org)

| Status | Now | After revamp |
| ------ | --- | ------------ |
| `pending_org_profile` | After IG create | Legacy only (drain existing rows) |
| `pending_email_verification` | After profile | After `/org/apply` |
| `pending_approval` | After `.edu` | After `.edu` (waiting room, no Connect) |
| `pending_instagram` | — | After Approve, until bind |
| `active` | After Approve | After IG bind |
| `denied` / `erased` | unchanged | unchanged |

`pathForUser`: `pending_instagram` → `/onboarding/connect-instagram`.

`CurrentOrg` stays **active** only. Drop feed / apply / campaigns unchanged.

### Files (Phase A)

| Area | Touch |
| ---- | ----- |
| Enum / migration | `OrgUserStatus.PENDING_INSTAGRAM`; `org_connect_tokens` (mirror `brand_invite_tokens`) |
| Apply | `POST /api/orgs/apply` public, rate-limited; schemas = today’s onboarding fields **plus** `instagramHandle` |
| Onboarding | Stop requiring IG handle on submit; keep `/onboarding/profile` for legacy `pending_org_profile` |
| Auth | `handle_instagram_callback`: bind-if-session-or-state; no insert; `ORG_APPLY_REQUIRED` |
| Verify | On onboarding verify success, **issue token pair + refresh cookie** (today verify does not log them in — that only worked because they already had an IG session) |
| Admin | Approve → `pending_instagram`; confirm copy; claimed handle on org list/detail; resend connect email |
| Email | Verify (gap locked copy) + new approval/connect bodies |
| SPA | `/org/apply`; connect page; Join CTA; `/login` copy for **returning** orgs; `pathForUser`; E2E |
| OpenAPI | regen |

---

## 5. Brand / drop motion

### Pre-B (historical — do not re-implement)

```
/brand/requests/new → POST /api/brands/me/drops {title, description}
  → INSERT drops (placehold.co, “Multiple Campuses”, capacity 10,
     window now+1d/+8d, stage request_received)
  → navigate /brand/drops/:id
Org GET /api/drops: any approved-brand drop except drop_finished
  → stub is Upcoming, then Open; Apply + Notify Me work
drop_autoclose: request_received + window passed → finalizing_agreements
```

Evidence at the time: `create_brand_drop`; `_browsable_drop_filters`; `jobs/drop_autoclose.py`.

PRODUCT §5.2 already said “request then Buzz logistics.” That as-built fought it until Phase B.

### Target (shipped — Phase B)

```
/brand/requests/new → POST /api/brands/me/drop-requests {message, notes?}
  → drop_requests (received)
  → brand dashboard: ticket “A representative will contact you.”
  → no drops row, no feed card, no Notify Me, no autoclose

Sales call out of band.

Admin: request detail, side-by-side ticket | draft editor
  save unpublished Drop (https image, real window, no placeholders)
  link converted_drop_id when first draft saved
  Publish → published_at set, tracker starts at awaiting_products
  email brand /brand/drops/{id}

Org feed: published AND not drop_finished AND brand approved.

Brand monitor + finalize: existing drop pages, only after publish.
```

Existing stub `drops` in prod: treat as unpublished / hide from org feed. Leave rows for ops. No data-delete migration.

### Files (Phase B)

| Area | Touch |
| ---- | ----- |
| Model | `drop_requests`; Drop `published_at` (nullable). Remove `request_received` from **new** drop tracker use. |
| Brand API | POST drop-requests only; **stop** `create_brand_drop`. |
| Admin API | Draft create/patch (creative + logistics + https image); **Publish**. Side-by-side request UI. |
| Feed | `published_at IS NOT NULL` and stage != `drop_finished` and brand approved. |
| Job | Autoclose **published** only. |
| SPA | Brand: tickets until publish; Admin: split ticket / draft + Publish. |
| Email | On **publish**, not on first draft save. |
| Tests / OpenAPI | Ticket absent from GET /api/drops; unpublished absent; published present. |

---

## 6. Email matrix (after Phase A+B)

| Kind | When | Notes |
| ---- | ---- | ----- |
| Org verify (signup) | Apply | Locked bodies in `org.edu-verify-outlook-junk`. HTML+text. From `Buzz <hello@bringthebuzzover.com>`. Reply-To `CONTACT_EMAIL`. |
| Org verify (rotate) | Officer swap | Same gap; different copy. |
| Org waiting | SPA only | Junk line. |
| Org approved + connect | Admin approve | New. Tester-accept + connect URL (token). **Not** “sign in at /login”. |
| Org denied / undeny / erase | unchanged intent | Restyle out of scope. |
| Brand invite / reset | unchanged | |
| Drop live | Admin **Publish** | New. Monitor URL. Not on draft save. |
| Notify Me | unchanged | Only real windows (stubs gone). |

Do not restyle every template in this revamp.

---

## 7. Admin / Meta ops (human, Phase A)

Already documented in [`META.md`](META.md) §D / [`DEPLOYMENT.md`](DEPLOYMENT.md) “No-review pilot path.” Add to admin org detail + this playbook:

1. Open org → copy claimed `@handle`.
2. Meta App Dashboard → App roles → Instagram Tester → that username (**invite sent**).
3. Approve in Buzz (confirm: I sent the tester invite).
4. Org email: accept invite at `instagram.com/accounts/manage_access/`, **then** Connect Instagram.
5. If Connect fails: they have not accepted, or account is Personal, or handle typo. Do not send them to `/login` as signup (that is `ORG_APPLY_REQUIRED`). Resend connect email.

Scale: hand-add testers. Fine for a seeded list. Not a public flood.

---

## 8. Public / marketing

**Phase A (with org apply):** Home Join “Join as Student Organization” → `/org/apply`. Footer org link same. `/login` stays for **returning** orgs; short line “New org? Apply here.”

**Phase C (after A+B):** `/for-orgs` and `/for-brands` per `spa.for-orgs-for-brands` locked v1, teaching **these** flows (not IG-first create, not stub-as-campaign). Un-park cluster `spa-role-tours`.

Do not promise: public IG login without testers; verified mailing address; brand self-configures logistics.

---

## 9. Step-by-step implementation

Do **not** start Phase C until A and B are archived. A and B are independent after PRODUCT lock — if one agent: **A then B**. Mailbox can run any time (human).

Each phase: implement → [simplify-pass](.agents/skills/simplify-pass/SKILL.md) → `./scripts/ci-local.sh` → archive that phase’s gaps → **stop for commit**.

### Phase 0 — already this change set

- This file.
- PRODUCT §§ 1, 3.1, 5.2, 6.1 rewritten to the target motions.
- Gap `org.signup-instagram-first` filed.
- Idea files point here. Clusters queued.

### Phase A — Org apply-first + verify mail

Cluster: `launch-org-apply`  
Gaps: `org.signup-instagram-first`, `org.edu-verify-outlook-junk`

Order:

1. Migration: `pending_instagram` enum value; `org_connect_tokens`.
2. Public apply API + SPA `/org/apply` (all current profile fields + **§6.1.1** Instagram confirm card; TikTok optional as today).
2b. Public rate-limited `GET /api/orgs/instagram-lookup?username=` via Meta **Business Discovery** (Buzz service IG + Facebook Login token — see [`META.md`](META.md) § apply lookup + rate limits). Server cache + per-IP limits; fake in tests.
3. Verify: mint session on success; locked HTML mail + Junk copy (do the full verify gap, not a subset).
4. Waiting room copy (no Connect).
5. OAuth: bind / reject insert / `ORG_APPLY_REQUIRED`.
6. Admin approve → `pending_instagram` + connect email + confirm copy.
7. Connect page + token redeem.
8. Join / login / footer CTAs.
9. Tests: apply without IG; verify sets cookie; approve not active; bind; unknown IG no insert; duplicate `.edu`; handle claim shown in admin; verify signup vs rotate bodies; **handle lookup + confirm required before submit**; not-found / not-professional surfaces Business/Creator copy.
10. E2E: replace “Join → Instagram → profile” with apply → (test) verify → pending; keep existing **bound** test org login.
11. OpenAPI regen.

**Stop if:** Meta tester add is impossible for a handle (Personal account) — still ship the product path; ops copy already says Business/Creator.

### Phase B — Admin-minted drops

Cluster: `launch-admin-drops`  
Gaps: `drops.unconfigured-request-on-org-feed`

Order:

1. Hide `request_received` from org feed / detail / notify / apply (**immediate honesty**, even before intake table).
2. Stop autoclose on `request_received`.
3. `drop_requests` + brand POST + SPA ticket UX; **delete** brand `create_brand_drop` path.
4. Admin side-by-side ticket | draft editor; save **unpublished** drop (https image, real window, every drop links to a ticket).
5. **Publish** (`published_at`); tracker starts at `awaiting_products`; email brand on **publish** (not draft save).
6. Admin PATCH title/description/image/location on drafts.
7. Tests: ticket absent from GET /api/drops; unpublished absent; published present; email on publish only.
8. OpenAPI regen.

**Stop if:** a live stub must stay on the feed for a demo — no; hide them.

### Phase C — Tours

Cluster: `spa-role-tours` (un-park after A+B archived)  
Gap: `spa.for-orgs-for-brands`

Frames match **this** plan. Stylized chrome, not View-as PNGs.

### Ops-parallel — mailbox

Gap: `ops.brand-mailbox` (already parked; un-park only when named).  
Does not block A–C. Do not flip `contactEmail` until receive + send-as proofs.

### Not a phase

Meta BV, App Review, address verifier, brand creative editor, Paper, AI, TikTok OAuth, email ledger, CSP, observability.

---

## 10. Surfaces after A–C (as-built)

As-built detail: [`ARCHITECTURE.md`](ARCHITECTURE.md). PRODUCT remains SOT for UX.

| Surface | After A–C |
| ------- | --------- |
| `/` Join org | `/org/apply` |
| `/login` | Returning orgs + “New org? Apply” |
| `/org/apply` | Public form |
| `/onboarding/profile` | Legacy drain only |
| `/onboarding/connect-instagram` | After approve |
| `/for-orgs` / `/for-brands` | Public role tours (Phase C) |
| `/brand/requests/new` | Creates ticket |
| Admin brand | Full create form + Publish |
| Admin org Approve | → `pending_instagram` |
| Org feed | **Published** only (`published_at` set); hide leftover unpublished stubs until ops cleanup |
| IG callback unknown user | 400 apply-required |

Unchanged on purpose: org Drop Feed card UX, My Campaigns, brand dashboard KPIs, batch finalize §7.1, View as, erase, `.edu` rotate, brand apply/password, admin tracker stage moves.

---

## 11. Why this order

- **A before C:** tours must not teach Continue-with-Instagram-as-signup.
- **B before C:** tours must not teach stub campaigns.
- **Verify mail inside A:** first-time orgs never complete apply if Outlook junks the token.
- **Hide `request_received` first in B:** cheapest honesty if create-drop slips.
- **Mailbox last/parallel:** Resend still delivers app mail without a human inbox.

---

## 12. Explicit OUT (do not sneak in)

Campus targeting, Calendly, EasyPost, guest brand dashboards, org passwords, magic-link as ongoing login after IG bind, admin CSV import, React Email, DMARC DNS unless named, public IG login copy, address validation vendor, brand hero upload/blob store (admin uses **https URL** in v1).
