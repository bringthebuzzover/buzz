# Buzz

**Bring the Buzz Over** is a specialized marketing platform built to connect brands with the unique, often hard-to-reach communities found on college campuses.

Buzz moves beyond traditional "cold ads" by leveraging the existing social fabric of universities. Rather than generic marketing, Buzz partners brands with established student organizations—such as Greek life chapters, athletic teams, and academic or social clubs—to enable more authentic campus engagement.

For brands, Buzz offers a centralized system to manage student-led campaigns across multiple colleges. Brands can handle approvals, and measure real-world engagement and on-the-ground impact—all within a single workflow.

For student organizations, Buzz acts as a marketplace where groups can find opportunities to collaborate with brands. They can access exclusive products, brand perks, and sponsored campaigns, allowing them to monetize their influence and share offerings that resonate with their mission.

At the core is the **BUZZ platform**: a technology suite that connects brands and student groups. It acts as a project management and discovery tool that allows marketing campaigns to scale across a network of top-tier institutions, including Cornell, Stanford, Harvard, Princeton, and MIT. The platform is designed to ensure that marketing feels organic and student-led rather than corporate-driven.

---

# Product Specification

This document describes Buzz’s product architecture, user experiences, lifecycle rules, data flow, and interactions. It reflects the intended behavior for the current product direction.

---

## 1. Executive summary

Buzz serves **two separate platform experiences** that intentionally do not overlap for real users:

| Dimension                  | Brands                                                          | Student organizations                                                                                     |
| -------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Go-to-market               | Sales-led (PLS)                                                 | Product-led (PLG) / sales-led (greek-life partnerships)                                                   |
| Onboarding                 | Sales-led ; Buzz reviews and onboards                           | Public **org apply** (profile + claimed Instagram handle + verified **.edu**), Buzz review, then **Connect Instagram** (tester-bind); portal after bind (**§3.1**, **§6.1**) |
| Scheduling / participation | Buzz coordinates ops; brands **batch-finalize** applicants after `apply_close_at` (§7.1) | Orgs discover campaigns, can enable notifications to be reminded when they drop, and apply (§6.3, §7)     |
| Primary portal             | Status tracker + KPI dashboards + content library               | Drop feed + campaign history                                                                              |
| Analytics lens             | Per-drop, aggregate across drops, engagement over time          | Own posts + aggregate engagement per active campaign                                                      |
| Motion                     | Representative-driven; brand **requests a call**, Buzz **mints** the drop (**§5.2**) | Self-serve apply (**.edu** first); Instagram **binds** after Buzz approval (**§6.1**) |

**Key product rule:** A real user belongs to **exactly one** portal (Brand **or** Organization). Internal operators may use admin **View as** (impersonation) to open an org or brand session — that is not a production multi-portal capability.

---

## 2. Terminology

- **Brand:** A company partner using Buzz in a sales-assisted model.
- **Organization (Org):** A student organization using Buzz in a self-serve model.
- **Drop:** A campaign instance with capacity, application windows, and lifecycle states visible differently to brands vs. orgs.
- **Campaign (org context):** An org’s participation in a specific drop (application through completion).
- **Spot:** One org slot in a drop’s fixed capacity.
- **Buzz / Admin:** Internal operators who onboard brands and orgs to the platform, manage **drop-request tickets** and **drop tracker** stages after publish (**§5.2**), agreements and exception handling, and operate behind the scenes where the product does not give the brand a direct control.
- **Drop applicant decisions:** After the application window closes, the **brand** **batch-finalizes** applicants (approve or deny up to capacity). Rules: **§7.1**. No accept writes while the chronological Open window is still running.

---

## 3. Access and identity

### 3.1 Production behavior

- No end user may belong to **both** the Brand portal and the Organization portal.
- Routing and permissions enforce a **single portal** per authenticated user.
- **Organization accounts** are created by a public **org apply** form (not by Instagram OAuth). Required: **university**, **org name**, \# of members, **organization type**, **contact name**, a **US shipping address** (street; optional apt, CPO, or PO Box; city, state, ZIP — provider-verified), a university **.edu** email, and a **claimed Instagram handle** confirmed on the same page via the inline lookup card (**§6.1.1**). The handle must be the org’s **Business or Creator** account — not a personal member profile. The handle is for Buzz ops (Instagram Tester) until OAuth **binds** Graph identity. Those profile fields remain required on later org profile edits (cannot be cleared). Shipping is US-only (including PO Boxes and campus CPO).
- After **.edu** verification the org awaits **Buzz admin review**. During review, Buzz adds the claimed handle as an **Instagram Tester** (Meta App roles; Standard Access). Admin **approval** does not open the portal yet: the org **Connects Instagram** (Business/Creator) so Graph ids/token attach to **this** user. **Portal access** (`active`) starts after that bind. Denied applicants are notified by **email** and do not Connect. A **denied** org keeps its claimed handle reserved until **erase** (another applicant cannot claim it).
- **Returning** org login is **Login with Instagram** on the bound account every time (no org password, no magic-link as ongoing login). Instagram OAuth **must not** create a second Buzz user. An unknown Instagram with no bind latch is told to apply first. The Instagram account used at connect/login **is** the organization account (Business/Creator). Claimed Instagram handles are **unique** among non-erased orgs (case-insensitive, `@` stripped). If Graph returns a different `@` at Connect than was claimed at apply, Buzz **binds anyway** and overwrites from Graph (ops may have tester’d a typo); log for ops.
- Instagram **follower count** is not manually entered — it is seeded from Instagram **at bind** when possible and refreshed daily (**§4.3**).
- After first `.edu` verification, orgs in **`active`**, **`pending_approval`**, or **`pending_instagram`** may **rotate** to a new unique campus `.edu` (officer swap). Buzz uses a **pending-swap**: the current `users.edu_email` stays the live login/contact identity; `users.pending_edu_email` holds the new address until the verification link is confirmed; then Buzz swaps, refreshes `email_verified_at`, and **does not** demote status or block the portal. Resend and Cancel apply to the pending latch. Rotate/cancel use dedicated verify-email APIs — not `PATCH /orgs/me`. Onboarding typo-fix (`POST /api/auth/verify-email/change` while `pending_email_verification`) is unchanged. **Resend verify** after public apply is allowed **without** a session (email + rate-limit).
- While **`pending_approval`** (verified `.edu`, no connect email yet), a lost session waits for the **approval email** — there is no connect link to resend. At **Approve**, if the org already has Graph ids/token on file (legacy mid-flight), Buzz may set **`active`** and skip Connect; otherwise → **`pending_instagram`**. Admin **View as** is not offered for `pending_instagram` (no portal until bind).

### 3.1.1 Data ownership (single source of truth)

Each fact is stored once; APIs may still expose familiar field names by joining the owner table.

| Fact | Owner column | Notes |
| --- | --- | --- |
| Org Instagram identity | `users.instagram_username` | Claimed at apply (ops / tester add); overwritten from Graph at bind. Exposed as `instagramHandle` on org profile / applicant rows |
| Org `.edu` email | `users.edu_email` | Unique login/verification identity; not editable via `PATCH /orgs/me`. Post-verify rotate uses pending-swap (`users.pending_edu_email`) via dedicated verify-email APIs |
| Org pending `.edu` rotate | `users.pending_edu_email` | Unique when set; cleared on verify, cancel, or erase |
| Brand display name | `brands.brand_name` | Drop/campaign responses join brand for `brandName` |
| Campaign tracking number | `drops.tracking_number` | One TN per drop; org/brand/admin surfaces read the drop |
| Post↔campaign membership | `drop_applications.drop_id` | Links/suggestions reference `application_id` only |
| Org shipping address | `organizations.shipping_line1` (+ `shipping_line2`, `shipping_city`, `shipping_state`, `shipping_postal_code`) | `delivery_address` is the formatted blob brands/admin print as Ship to. Campus `city`/`state` columns are leftover, not collected. |

`organizations` holds club profile metadata (name, campus, address, etc.). `brands.instagram_handle` remains a separate brand-side field used for autolink caption matching.

### 3.1.2 Org account erase (data-deletion fulfillment)

After a verified data-deletion request (mailto on `/data-deletion`), a Buzz **admin** may **erase** an organization account from the admin org detail page (confirm by typing the Instagram handle).

- Erase removes login identity and contact PII (IG ids/token/username, email on file, shipping/contact fields) and ends the session (`token_version` bump). The account status becomes **erased** (terminal — not the same as onboarding **denied**).
- Erase **does not** remove attributed campaign KPIs (**§4.3**). Accepted seats, linked posts’ numeric metrics, follower-based reach inputs, and campus strings are retained; the org may appear as an anonymized tombstone (e.g. “Deleted organization”) on brand/admin surfaces.
- When an email address is on file before erase, Buzz may send a **confirmation email** to that address after a successful erase (best-effort; failure does not undo erase).
- **v1:** no brand-portal erase; no self-serve account delete; Meta Hosts continue to use the public instructions URL (not a data-deletion callback).

### 3.2 Demo / internal preview

Production users cannot switch portals. Internal operators use admin **View as** (impersonation) to open an org or brand session; see [`TESTING.md`](TESTING.md) / [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## 4. Drops — shared concepts

### 4.1 Capacity & application window (timing)

Each drop has a **fixed maximum number of organization spots** (e.g. 10). Drops may also carry an **optional total product unit budget** (`total_product_units` — **nullable** when units are unknown or not applicable at request time) that brands distribute across approved orgs during **batch finalize** after the window closes (**§7.1**). Multiple orgs may **apply** while the drop is **Open**. During Open, applications stay **pending review** — brands do **not** accept or deny while `now <= apply_close_at`.

For v1, drops expose two timestamps:

| Field            | Purpose                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `apply_open_at`  | When applications open; drives **Upcoming** → **Open** transition for org UX and countdown before open. |
| `apply_close_at` | When the application window ends; after this, brands **batch-finalize** applicants (**§7.1**).          |

**Timing outcomes:** When `apply_close_at` passes, the window **auto-closes** (no new applications under the open window). After auto-close or any other closure, **Buzz** may **manually reopen** (admin UX TBD). Capacity-**Closed** on the org feed (approved orgs fill all spots) is a **post-selection** outcome — or a **reopened** window with prior accepts already counting toward capacity — not a first-window Open path (**§7.2**). These timestamps also drive org feed states (**§6.3**).

### 4.2 Post attribution (hard constraint)

- A single **social media post** (one canonical post identity on a platform) may be linked to **at most one** campaign (one org’s participation in one drop).
- The system must prevent double-assignment across campaigns.

### 4.3 Metrics

- Likes, comments, and related engagement metrics are **refreshed periodically** (not a one-time snapshot at submission).
- **Estimated reach (v1 definition):** Derived from **follower counts** of the participating student org(s) (and/or connected accounts as implemented), combined with product rules for display. Connected org follower counts are **Graph-owned**: best-effort seed from Instagram **at Instagram bind**, then **refreshed daily** when a usable token is on file (same cadence as post metric sync). Manual follower edits on onboarding/profile are not allowed.
- **Aggregate likes:** Show **aggregate likes** across the campaign’s linked posts (in addition to or alongside estimated reach, per product copy).
- Brand-facing layout (per-org, UGC, roll-ups): **§5.3**.
- **KPI preservation (hard rule):** Attributed campaign contribution — linked post counts, likes, comments, engagement series, estimated reach from retained follower counts, and campus counts from retained university — **must not disappear** when an org account is erased or identity is removed (**§3.1.2**). Identity, contact PII, IG credentials, and identifiable post content (permalinks, captions, media) may be scrubbed or anonymized; **numeric campaign stats stay**. Brand dashboards may show a tombstone participant label with prior metrics intact.

---

## 5. Brand experience (PLS)

### 5.1 Onboarding

1. Brand submits **company information** and a **short message** (intent / context for Buzz).
2. A Buzz representative **manually reviews** the submission, then we schedule a call
3. Upon approval, the brand is **onboarded** into the Brand portal.

**Interaction notes:**

- Brand does not self-configure drop logistics in a PLG sense; the rep is the operational owner.

### 5.2 Requesting a drop

A **drop request** and a **drop** are different objects. Public **`/for-brands`** illustrates this motion (ticket → admin draft → **Publish**).

1. Brand submits a **drop request** (intake ticket: free-text message / notes). That text is **not** the campaign title or description. The request is **not** a live campaign and **must not** appear on the org Drop Feed. Brand-facing ticket copy: a representative will contact them.
2. A Buzz representative handles **agreements, logistics, product shipment, and scheduling** behind the scenes (sales call out of band).
3. A Buzz **admin** opens the ticket beside a **draft drop editor** (side-by-side). They write title, description, hero **https** image URL, location, capacity, apply window, optional units / hashtag — using the ticket as reference, not as auto-fill. Save as **unpublished draft**. Every drop **must** link to a ticket; admin cannot create a drop without one.
4. Admin **Publish**. Only then: orgs can see the drop (Upcoming countdown / Open apply); Notify Me and autoclose key off the real window; the brand **tracker** starts at **Awaiting Products** and the brand is emailed `{FRONTEND_URL}/brand/drops/{id}`.
5. After publish, the brand sees a **read-only status tracker** (Buzz updates stages). Brand users do not edit logistics or creative in v1 of this motion. The owning brand may **view unpublished drafts** on the brand portal (not on the org feed).

The owning brand **monitors** applicants and KPIs and **batch-finalizes** after `apply_close_at` (**§7.1**). They **cannot** mint or publish a `Drop` from the portal.

**Ticket vs tracker:** “Request received” is **ticket** status, not a drop tracker stage.

**Brand-facing drop tracker stages (after publish, canonical order):**

1. **Awaiting Products** — _Shipped — tracking number shown_ (when applicable)
2. **Drop Active** — _Campaign is live_
3. **Drop Finished** — _Campaign complete_

**Interactions:**

- Brand users **cannot** advance these tracker stages themselves.
- Tracking number appears when relevant at **Awaiting Products** (and may remain visible where product copy dictates).
- Unpublished drafts are **not** on the org feed; the brand may still see them on brand surfaces.

#### 5.2.1 Logistics integrations (e.g. EasyPost)

**Today (MVP):** Buzz admins enter tracking numbers on the drop tracker; there is **no** EasyPost (or other carrier) integration in the shipped product.

**Future:** Buzz may integrate shipping and tracking with external providers (for example **EasyPost**) so brands can enter or sync tracking numbers, and eventually generate labels and receive webhook-driven carrier events (e.g. in transit, delivered) where the implementation supports it.

**NOTE:** Exact split of responsibilities (Buzz vs. brand vs. automation) for each milestone should follow the same tracker UX unless the product explicitly hands a step to the brand through the integration.

**TODO:** Finalize EasyPost (or vendor) scope — API keys, webhook surface, who may purchase labels, rate shopping, multi-package drops, org-facing vs. brand-facing tracking parity, and error handling.

### 5.3 Brand dashboard — two views

#### 5.3.1 Per-drop view

When a drop is past the application window (post-window **selection** stage — after
`apply_close_at`, while Buzz ops may still be coordinating shipment), the brand can open it and sees:

- **Applicants and participants by organization:** Each applying org appears as its own row (or card). Brands **finalize** applicants **after `apply_close_at`**, approving or denying up to capacity (and allocating units when budgeted) — not as rolling mid-window decisions during Open (**§7.1**). Approved orgs remain visible for the lifecycle of the drop.
- **All social posts** linked or submitted for the drop, **grouped by org** where useful, plus roll-up summaries across the drop.
- **Per-post metrics:** likes, comments, estimated reach (per implementation), aligned with platform analytics where applicable.
- **Drop-level KPIs:** total engagement, total reach, **cost per engagement** (if cost inputs exist in the product; otherwise hide or N/A per implementation).

**UGC library (per drop or linked surface):** A single place for the brand to **preview** posts, Reels, and photos contributed for that drop and to **download** approved assets for reuse in the brand’s own marketing.

**TODO (UGC):** Usage rights, consent scope, watermarking, export formats, retention, and moderation / takedown — product and legal to define.

**Interactions:**

- Read-only analytics exploration (filters, date ranges, etc. are optional v2+ unless specified).
- **Applicant finalize** (approve / deny) is available in the post-window selection stage; analytics and library browsing remain read-only except where downloads are explicitly offered. Brands can filter through applicants (sorority, fraternity, sports, academic club, region, etc)
- In the future: there would be a matching algorithm.

#### 5.3.2 Aggregate dashboard

A separate **high-level** view across **all** the brand’s drops:

- **Total reach** and **total engagement** across campaigns.
- **Engagement over time** — chart tracking performance **across drops** (time series).
- **Compare drops** — comparative view (table, chart, or cards — implementation detail).
- **Running totals** — e.g. posts submitted, orgs involved, campuses reached (definitions depend on data captured).

**Interactions:**

- Brand selects time ranges or drops to compare (if offered).
- This view stays **primarily aggregated** across drops; **per-org** detail lives on the **per-drop** campaign surface (§5.3.1).

---

## 6. Organization experience (PLG)

### 6.1 Onboarding

1. Org user submits a public **org apply** form: **university**, **org name**, \# of members, **organization type**, **contact name**, a **US shipping address** (street; optional apt/CPO/PO Box; city, state, ZIP — provider-verified), campus **.edu**, and the organization’s Instagram **handle** via **§6.1.1** (lookup + same-page confirm). This **creates** the Buzz account. Instagram OAuth does not. Shipping is US-only.
2. Buzz sends a **verification** to that **.edu** address; the user completes verification (confirm on the verify page).
3. After **verified .edu**, the org enters **pending Buzz review**. A Buzz admin reviews the org. During review, Buzz adds the claimed handle as an Instagram Tester (Meta; Standard Access), then **approves** or **denies**.
4. After **approval**, the org **Connects Instagram** on the organization Business/Creator account. OAuth **binds** Graph identity to this user (token, ids, handle from Graph). Follower seed runs at bind (**§4.3**).
5. After bind, the user is **`active`** and is granted the Organization portal (Drop Feed, My Campaigns). **Returning** sign-in is Login with Instagram. Denied applicants are notified by **email** and do not Connect or gain portal access.

**Access gate:** Portal features are unavailable until step 5 completes. Apply, post library, and Graph follower counts require the Instagram bind. `.edu` verification or admin approval alone does not open the feed.

Typed TikTok handle on the org profile remains optional. Connecting TikTok as a second OAuth account is **not** v1 (**§11**).

#### 6.1.1 Instagram handle — same-page confirm card

On **`/org/apply`** (and illustrated on public **`/for-orgs`** — Phase C), the Instagram handle is **not** free text alone.

**Always visible (apply + for-orgs):**

- The account must be the **organization’s** Instagram **Business or Creator** profile — **not** a member’s personal account.
- Plain-language note that personal accounts cannot be used and that Buzz will verify the account type at lookup / Connect.

**On `/org/apply` (single page — no separate confirm route):**

1. Applicant types their handle (with or without `@`).
2. After a **debounced pause** (~500ms) on a valid username shape, Buzz looks up that **exact** handle server-side (Meta Business Discovery — see [`META.md`](META.md) for limits and caching). There is **no** Instagram-style typeahead of similar handles (not supported by Meta’s public API). Do **not** call Meta on every keystroke.
3. **Inline on the same form**, show a **confirm card** when lookup succeeds:
   - Profile picture, `@username`, display name (when available), follower count, short bio snippet.
   - Primary action: **“Confirm this is our organization’s account.”**
4. **Submit** stays disabled until the user confirms the card for the current handle — **except** soft-fail (below).
5. If the user **edits the handle** after confirming, clear confirmation and re-run lookup.
6. **Lookup failure states** (inline on the card, same page):
   - **Not found** or **not a Business/Creator (professional) account** → explain they need a professional org account (not personal); link to Meta’s convert-to-professional help where useful. **Blocks submit.**
   - **Transient API error**, **rate limit**, or **lookup unavailable** (token unset / Meta outage) → **soft-fail**: retry affordance; do **not** block typing; allow submit with the handle marked **unconfirmed**. Admin org detail surfaces the unconfirmed flag so ops can verify before Approve.
7. Confirming the card only latches the **claimed handle** for apply — it does **not** OAuth-bind or open the portal. Connect still happens after Buzz approval (**§6.1** step 4).

**`/for-orgs`:** Requirements list and at least one stylized frame must show this handle field + confirm card pattern and the Business/Creator requirement (not only a bullet in prose).

**Explicit OUT:** separate `/confirm-instagram` step; unofficial/scraped IG search typeahead; requiring OAuth at apply time.

### 6.2 Pages

Orgs have **two separate** surfaces:

1. **Drop Feed** — discovery and application; **not** mixed with history.
2. **My Campaigns** — participation history and active campaign management.

---

### 6.3 Drop Feed page

**Purpose:** Browsable catalog of **available** and **upcoming** drops.

Each **drop card** shows:

- Drop details and **brand** identity (as permitted by product).
- **Spots:** first Open window (_“Up to 10 spots”_); after finalize + reopen with prior accepts, depleting leftovers (_“4 of 10 spots remaining”_). Capacity full → **Closed** chip (**§7.2**).
- **Status** for org UX: **Upcoming**, **Open**, **Closed**.

#### 6.3.1 Status: Upcoming

- Before `apply_open_at`, the drop is **Upcoming**.
- Show a **live countdown** to `apply_open_at`.
- **Notify Me** button:
  - Persisted **server-side** as a per-org, per-drop subscription; shows confirmation: _“You’re on the list — we’ll let you know when this opens.”_
  - The org picks a lead time (5 / 15 / 60 minutes before `apply_open_at`).

**Interactions:**

- Tapping **Notify Me** records the subscription on the backend; revisits show the already-subscribed state from the server.
- Org may opt out (remove the subscription) before `apply_open_at`.
- **Delivery:** a reminder email goes to the org's `.edu` address once the chosen lead time is reached, sent at most once per subscription. The scheduler runs every ~5 minutes, so the shortest lead time can land a few minutes late. Push is still out of scope (**§11**).

#### 6.3.2 Status: Open

- After `apply_open_at` and before closure conditions, the drop is **Open** (subject to `apply_close_at` and not closed for other reasons — **§4.1**). Orgs may **Apply** while Open; applications stay pending until batch finalize (**§7.1**).
- **Spots line:** first Open (`acceptedCount === 0`) shows capacity as _“Up to N spots”_ (accepts do not deplete during the first window). A **reopened** window with prior accepts may show _“M of N spots remaining”_. At capacity on the feed: **§7.2** (post-selection / reopen leftovers — not mid-window accepts).

#### 6.3.3 Status: Closed

- **Closed** when: `apply_close_at` has passed (unless manually reopened), capacity is filled per **§7.2** (after selection, or reopen with prior accepts), Buzz manually closed the drop, or other admin actions. **Reopen:** **§4.1**. Capacity fill alone does **not** close a first-window Open drop before finalize.

**Interactions:**

- **Apply** is not available.
- **Notify Me** may be hidden or irrelevant depending on state (product decision: typically only for Upcoming).

---

### 6.4 My Campaigns page

**Purpose:** History of all drops the org has **interacted with** (applications, acceptances, active, finished — see below).

- **Sort:** Active campaigns **first**, then others (e.g. by recency).

#### 6.4.1 Org-facing campaign stages

Each campaign shows a **status** in this progression:

1. **Applied**
2. **Accepted** — _Awaiting product_ (tracking number shown when available)
3. **Active** — _Drop is live_
4. **Finished**

Drop-level denial (brand): **§7.1**.

**Interactions:**

- Tap a campaign to open **campaign detail** appropriate to status.

#### 6.4.2 When a campaign is Active — campaign detail

The org can:

- **Select** which of **their** social posts **relate to this drop** (subject to the **one-post-one-campaign** rule).
- See an **aggregate engagement score** across all **selected** posts for that campaign.

**Data flow implication:**

- That aggregate feeds **directly into** the **brand’s per-drop dashboard** (along with other orgs’ contributions), attributed **per org** for management and UGC (§5.3.1).

---

## 7. Applications, acceptance, and capacity — rules

Each drop has **fixed org capacity** and an **application window** (**§4.1**). **§7.1**–**§7.3** define applicant review, capacity exhaustion on the feed, and concurrent participation. **Upcoming / Open / Closed** on the org feed follow **§4.1** and **§6.3**.

### 7.1 Application flow (org → brand)

**No waitlist** — each applicant is either pending review, approved, or denied. **Collect-all-then-pick:** there are **no accept writes while `now <= apply_close_at`** in v1.

1. Org submits **Apply** on an **Open** drop (if allowed by time + state; **§4.1**, **§6.3**). Applications stay pending through the window.
2. After `apply_close_at`, the **brand** **batch-finalizes** applicants for that drop (typically in the post-window selection stage).
3. For each applicant the brand **approves** or **denies**:
   - **Approved** — counts toward capacity; if the drop has a `total_product_units` budget (**§4.1**), the brand also **allocates units per approved org**, with the sum of allocations capped by the budget. Org moves to **Accepted** in **My Campaigns** when product rules expose that state (subject to fulfillment and activation).
   - **Denied** — **no** row in **My Campaigns** for that application; **email** only.

### 7.2 Capacity exhaustion

- When brand-**approved** orgs (via finalize) **fill** all spots:
  - Drop shows as **Closed** on the **Drop Feed** (org cannot apply as Open; no waitlist).
- That Closed state is **post-selection**, or on a **reopened** window with prior accepts already counting toward capacity — **not** a first-window Open path (accepts do not accumulate while the chronological window is still open).

### 7.3 Concurrent participation

- An org **may** hold **brand-approved** spots on **multiple drops** simultaneously.
- Any **future** limits (e.g. max concurrent campaigns) are **TBD by Buzz** and not enforced in this v1 spec unless added later.

---

## 8. Data flow and aggregation

```
Orgs apply while Open; after apply_close_at, brand batch-finalizes (§7.1)
              ↓
Accepted orgs submit / link posts for the drop
              ↓
Buzz pulls / refreshes metrics per post (likes, comments, reach estimates)
              ↓
Per-org + roll-up  →  Brand per-drop view (applicants, posts, UGC library)
Aggregated all drops →  Brand aggregate dashboard
                     →  Engagement over time chart
```

**Org-visible data:**

- Org sees **its own** posts and **its** aggregate for the campaign.
- Org does **not** see other orgs’ posts or brand-global totals (unless explicitly added later).

---

## 9. Status authority

- **Brand:** Batch-finalize (approve/deny) drop applicants **after `apply_close_at`** (**§7.1**). Org moves **Applied → Accepted** after brand approval (labels may differ by surface).
- **Buzz:** Brand **platform** onboarding; drop-request **tickets** and drop **tracker** stages after publish (**§5.2**); agreements and ops coordination; **§4.1** reopen; **org** lifecycle beyond applicant choice (e.g. **Active** / **Finished** when fulfillment and campaign rules are met — triggers TBD with brands). Org **portal access** is gated by **.edu** verification, Buzz admin approval, then **Instagram bind** (**§6.1**).
- **Automation / rules:** Feed **Open/Closed** follows **§4.1**, **§6.3**, **§7.2** (capacity-Closed is post-selection / reopen leftovers, not mid-window accept).

---

## 10. Interaction matrix (quick reference)

| Actor | Surface             | Primary actions                                                                                                                  |
| ----- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Brand | Onboarding          | Submit info + message; wait for rep                                                                                              |
| Brand | Drop request        | Submit ticket; wait for Buzz; after publish, view read-only tracker on the drop                                              |
| Brand | Per-drop dashboard  | Batch-finalize applicants after close; per-org posts + metrics; drop KPIs; UGC preview/download                                |
| Brand | Aggregate dashboard | Totals, time series, compare drops, running totals                                                                               |
| Org   | Onboarding          | Public apply (profile + **§6.1.1** Instagram confirm card + **.edu**); verify; Buzz review; accept Instagram Tester invite; Connect Instagram; then portal |
| Org   | Drop Feed           | Browse; countdown + Notify Me (server subscription); Apply                                                                                     |
| Org   | My Campaigns        | Track status; manage posts when Active                                                                                           |
| Buzz  | Admin (conceptual)  | Platform org/brand onboarding; move brand tracker stages; timing/reopen/fulfillment coordination; erase org account after verified data-deletion request (**§3.1.2**); integrations (see §5.2.1 TODO) |

---

## 11. Non-goals and v1 scope boundaries

- **Notify Me push notifications:** Out of scope — reminder delivery is **email only** (**§6.3.1**).
- **In-app denial UI for orgs:** Out of scope — channel is **email**; rules **§7.1** (drop applicant denials).
- **Rich drop scheduling beyond apply window:** Only `apply_open_at` and `apply_close_at` specified for v1; other timestamps may be implicit inside Buzz ops.
- **TikTok OAuth / dual-platform metrics:** Out of v1. Org profile may store an optional typed TikTok handle. Connecting TikTok as a login or metrics source is later.

---

## 12. Open product decisions (explicitly TBD)

- Future **policy limits** on how many concurrent drops an org may hold.
- Exact **cost per engagement** inputs and formulas.
- Admin tooling UX for **reopen**, exception handling, and Buzz override paths (if any) when a brand is unresponsive.
- Whether **tracking numbers** surface in multiple places simultaneously (brand tracker vs. org campaign).
- Shipping (**§5.2.1** TODO) and **UGC** policy (**§5.3.1** TODO): detail lives in those subsections, not duplicated here.
