---
id: admin-drops
title: Admin-minted drops; brand requests a sales call, then monitors
status: promoted
updated: 2026-08-25
---

# Admin-owned drop creation (sales call → Buzz builds → brand monitors)

**Implementation locks live in [`LAUNCH.md`](../LAUNCH.md)** (option B + creative = admin at mint). Remaining forks in this file are **closed there**. Do not implement from here.

Related: [`gaps/drops.unconfigured-request-on-org-feed.md`](../gaps/drops.unconfigured-request-on-org-feed.md)
(this is now that gap’s locked fix),
[`gaps/brand.drop-creative-uneditable.md`](../gaps/brand.drop-creative-uneditable.md),
[`gaps/ops.brand-mailbox.md`](../gaps/ops.brand-mailbox.md),
[`gaps/spa.for-orgs-for-brands.md`](../gaps/spa.for-orgs-for-brands.md)
(public `/for-brands` tour waits until B ships — do not teach stub-as-campaign).

## Desired motion

Drop **configuration** sits with Buzz, not with the brand.

1. The brand brings requirements on a **sales call**: campuses they want,
   regions / org types, units, timing, creative, what “good” looks like.
2. In the brand portal, **Plan your Campaign** is a **request to talk with a
   Buzz representative** — not a self-serve drop builder.
3. After the call, ops has the intake. A **Buzz admin** drafts the drop beside the
   ticket (creative + logistics), then **Publish** (real apply window, real hero).
4. On **Publish**, the brand gets a link to monitor applicants, KPIs, and tracker.
5. After `apply_close_at`, the brand **batch-finalizes** applicants as today
   ([`PRODUCT.md`](../PRODUCT.md) §7.1).

**One-liner:** Buzz builds the campaign; the brand monitors and selects.

## Locked: option B

Split **intake** from **campaign**. A request is not a `drops` row.

1. **Plan your Campaign** creates a `drop_requests` row: message, optional notes.
   Stage copy: *A representative will contact you.* No `apply_open_at`. Not on the org feed.
2. Sales call happens out of band (Calendly, phone, email).
3. Admin **side-by-side** ticket | draft editor. Every `drops` row links to a ticket.
   Save **unpublished draft** (title, description, https hero, location, capacity,
   window, units, hashtag). Brand may see drafts; orgs do not.
4. Admin **Publish** sets `published_at`; tracker starts at `awaiting_products`.
   Email brand `{FRONTEND_URL}/brand/drops/{id}` on **publish** (not draft save).
5. Brand portal: ticket + draft until published; then existing drop detail. Finalize unchanged.

New table + admin create + one Resend template. Existing monitor / finalize
/ KPI code stays. Org feed only ever sees configured rows.

```
Brand: Plan your Campaign
  → short “talk to Buzz” form (goals; campuses if they know them)
  → confirmation + ticket on the brand dashboard (not a drop)

Buzz: sales call (out of band)
  → collect requirements, campuses, units, timeline, creative

Admin: Create drop for {brand} (from the request, or from the brand)
  → full config form (no server placeholders)
  → insert a real Drop with a real apply window
  → send brand the monitor URL

Org feed: only then (Upcoming countdown / Open apply)

Brand: /brand/drops/:id
  → tracker (read-only)
  → applicants + follower counts + filters
  → batch-finalize after close
  → KPIs / UGC as posts land
```

**Do not rebuild** the brand monitor or finalize surfaces. They already
are the destination of this motion.

**Do not invent** an unauthenticated magic link unless a non-login
stakeholder must see the drop. Logged-in brand session + email deep link
is enough (same family as brand invite landing on a known path).

### Not chosen

| Option | Why not |
| --- | --- |
| **A** — hide `request_received` stubs until publish | Stop-gap only. Brand still mints a `drops` row with a fake window. |
| **C** — mailto/Calendly CTA, no intake row | No in-app receipt; pipeline lives in inbox. Fragile until company mailbox exists. |
| **D** — admin impersonates brand POST | Placeholders, leak, worst ops UX. |

## What PRODUCT already says

This is closer to the spec than to the as-built.

- §1 / §5.1: brands are **sales-led**. “Brand does not self-configure drop
  logistics in a PLG sense; the rep is the operational owner.”
- §5.2: brand **submits a drop request** → Buzz handles agreements, logistics,
  shipment, scheduling → brand sees a **read-only tracker**. Brand users
  cannot advance tracker stages.
- §5.3.1: once the window is past (selection / later stages), the brand opens
  the drop: applicants by org, posts, KPIs, UGC; **finalize after close**.
- §9: Buzz owns tracker stages, reopen, fulfillment; the **brand** owns
  applicant approve/deny.

What PRODUCT does **not** say: that the request **is** a `drops` row, that
the brand picks capacity / window / location, or that orgs should see the
campaign before Buzz has configured it.

When implementing B, rewrite §5.2 so the request is an intake ticket and
the `Drop` is admin-created. Do not leave “submits a drop request” reading
as `POST /api/brands/me/drops` → live campaign.

## What exists today (as-built)

**Brand “Plan your Campaign”** (`/brand/requests/new`) POSTs
`/api/brands/me/drops` with **title + description only**.
`create_brand_drop` immediately inserts a live `Drop`:

| Field | Server default |
| --- | --- |
| `image` | `https://placehold.co/600x400/png` |
| `location` | `"Multiple Campuses"` (display string, not targeting) |
| `capacity_total` | `10` |
| apply window | now+1d → now+8d |
| stage | `request_received` |
| units / hashtag | unset |

The SPA then **navigates to `/brand/drops/:id`** as if the campaign existed.

**Org feed** (`_browsable_drop_filters`) shows any drop from an approved
brand that is not `drop_finished`. Tracker stage is ignored. A stub becomes
**Upcoming** (countdown + Notify Me), then **Open** (Apply) when the fake
window hits — see the unconfigured-request gap.

**Admin** can `PATCH /api/admin/drops/{id}` for capacity, window, units,
hashtag (locked once `drop_active` / `drop_finished`). Admin **cannot
create** a drop. Admin **cannot** patch title, description, image, or
location (`AdminDropConfigPatch` left those OUT of `brand.drop-create-thin`).

**Brand monitor + finalize already exist** and match the desired end state:

- `/brand/dashboard` — aggregate KPIs across drops
- `/brand/drops/:id` — tracker, applicant table (category filter, follower
  count per org), KPIs, **Finalize Selection** after close
- Auth is the brand session. A “link” is just `{FRONTEND_URL}/brand/drops/:id`
  for a logged-in brand user — no share token today.

**Closest create analog:** admin **Invite brand** (`POST /api/admin/brands`)
→ email `/brand/setup?token=` → password → session. We provision the
customer record; they do not self-assemble it.

## Why the current shape fights the motion

The product pretends the brand **created a campaign**. Ops then reverse-
engineers a real one onto a row that already has a ticking window, a
placeholder hero on the org feed, and an autoclose job that will advance
`request_received` → `finalizing_agreements` after +8d even if nobody
configured it.

That is the opposite of “sales call, then Buzz builds, then brand watches.”

Campus / area **targeting** is also missing: `drops.location` is a free-text
label. Eligibility is “any approved org sees every non-finished drop.”
Intake about “Cornell + SEC greek life” cannot be enforced in v1 without a
separate targeting decision.

## Architecture (B)

Reuse patterns; do not add a second drop lifecycle.

| Piece | Approach |
| --- | --- |
| Intake | `drop_requests` table: `brand_id`, message / notes, status (`received` / `converted` / `closed`), `converted_drop_id` nullable. No apply window. |
| Brand create | Repoint `POST /api/brands/me/drops` at intake **or** new `POST /api/brands/me/drop-requests`. Do **not** insert a `Drop`. |
| Admin create | `POST /api/admin/brands/{brand_id}/drops` with every field `Drop` already requires (title, description, image, location, capacity, window, optional units/hashtag). Optional `drop_request_id` to promote. No placehold.co. |
| Admin creative | Fold title / description / image / location into admin PATCH (today’s gap left them OUT). Ops can fix copy after mint. |
| Org visibility | Feed only lists real `drops` rows. Requests never appear. |
| Notify / autoclose | Key off the admin-created window only. No stub can enqueue reminder mail. |
| Brand email | New Resend body: drop title + monitor URL + “you’ll finalize after the window.” |
| SPA | Admin: Create drop (brand detail and/or from a request). Brand: Plan your Campaign → ticket receipt; drop detail only after convert. Org: unchanged cards, honest data. |
| Tests | Request not in `GET /api/drops`; admin-created drop is; brand GET request vs drop; autoclose/notify ignore requests; finalize still §7.1. OpenAPI regen. |

**Campus targeting** (only some orgs see the drop) is a **later fork**:
schema (`university` / region / org type filters), feed predicate, and
PRODUCT §6.3. Intake notes can be admin-only text in v1; do not pretend
`location` is eligibility.

**Follower rollup “across total applicants”** is mostly a display add on
the existing applicant list (`follower_count` is already on the brand
applicant schema). Sum-while-pending vs sum-accepted-only is a product
sentence, not a new pipeline.

## Locks closed (implement from LAUNCH.md only)

All forks are closed in [`LAUNCH.md`](../LAUNCH.md) §2 (ticket vs drop, draft,
Publish, side-by-side editor, https image, admin creative, three tracker stages,
ticket required, brand sees unpublished drafts). This file is provenance — do not
implement from the ASCII flow or “what exists today” sections without checking LAUNCH.

## Explicit OUT

- Option A (hide stubs) as the shipped fix.
- Option C (no intake table) and D (impersonate POST).
- Campus eligibility / matching algorithm (§5.3.1 “in the future”).
- Calendly / in-app scheduler (sales call stays ops).
- EasyPost / shipment automation (§5.2.1).
- Guest (logged-out) brand dashboards.
- Changing org apply / Notify Me / finalize rules.

The monitor and finalize UX the pitch wants is already the brand per-drop page.
