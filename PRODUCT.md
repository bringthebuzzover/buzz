# Buzz

**Bring the Buzz Over** is a specialized marketing platform built to connect corporate brands with the unique, often hard-to-reach communities found on college campuses.

Buzz moves beyond traditional "cold ads" by leveraging the existing social fabric of universities. Rather than generic marketing, Buzz partners brands with established student organizations—such as Greek life chapters, athletic teams, and academic or social clubs—to enable more authentic campus engagement.

For brands, Buzz offers a centralized system to manage student-led campaigns across multiple colleges. Brands can issue creative briefs, handle approvals, and measure real-world engagement and on-the-ground impact—all within a single workflow.

For student organizations, Buzz acts as a marketplace where groups can find paid opportunities to collaborate with brands. They can access exclusive products, brand perks, and sponsored campaigns, allowing them to monetize their influence and share offerings that resonate with their mission.

At the core is the **BUZZ platform**: a technology suite that connects brands and student groups. It acts as a project management and discovery tool that allows marketing campaigns to scale across a network of top-tier institutions, including Cornell, Stanford, Harvard, Princeton, and MIT. The platform is designed to ensure that marketing feels organic and student-led rather than corporate-driven.

---

# Product Specification

This document describes Buzz’s product architecture, user experiences, lifecycle rules, data flow, and interactions. It reflects the intended behavior for the current product direction (including demo-specific affordances).

---

## 1. Executive summary

Buzz serves **two separate platform experiences** that intentionally do not overlap for real users:

| Dimension                  | Brands                                                          | Student organizations                                                                                     |
| -------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Go-to-market               | Sales-led (PLS)                                                 | Product-led (PLG)                                                                                         |
| Onboarding                 | Sales-assisted; Buzz reviews and onboards                       | **Login with Instagram**; profile + verified university **.edu** email grants access (**§3.1**, **§6.1**) |
| Scheduling / participation | Buzz coordinates ops; brands approve applicants per drop (§7.1) | Orgs discover drops and apply (§6.3, §7)                                                                  |
| Primary portal             | Status tracker + KPI dashboards                                 | Drop feed + campaign history                                                                              |
| Analytics lens             | Per-drop, aggregate across drops, engagement over time          | Own posts + aggregate engagement per active campaign                                                      |
| Motion                     | Representative-driven                                           | Self-serve signup (Instagram + **.edu** verification)                                                     |

**Key product rule:** A real user belongs to **exactly one** portal (Brand **or** Organization). **Demo users** with demo access may switch views for presentation purposes.

---

## 2. Terminology

- **Brand:** A company partner using Buzz in a sales-assisted model.
- **Organization (Org):** A student organization using Buzz in a self-serve model.
- **Drop:** A campaign instance with capacity, application windows, and lifecycle states visible differently to brands vs. orgs.
- **Campaign (org context):** An org’s participation in a specific drop (application through completion).
- **Spot:** One org slot in a drop’s fixed capacity.
- **Buzz / Admin:** Internal operators who onboard brands and orgs to the platform, move brand **drop-request** tracker stages, manage agreements and exception handling, and operate behind the scenes where the product does not give the brand a direct control.
- **Drop applicant decisions:** The **brand** approves or denies each applicant up to capacity. Rules: **§7.1**.

---

## 3. Access and identity

### 3.1 Production behavior

- No end user may belong to **both** the Brand portal and the Organization portal.
- Routing and permissions enforce a **single portal** per authenticated user.
- **Organization users** sign in with **Login with Instagram** (Instagram is the account identity for the org portal).
- On first signup, the org completes a short profile—**university**, **org name**, and a **university .edu email** address—and must **verify** that email before the Organization portal **grants access**. Until verification succeeds, the user remains in a pending state (no full portal access).

### 3.2 Demo behavior

Users who have **demo access** can choose how they experience the web app:

- On first entry (or when appropriate), the app prompts whether to view as **Brand** or **Student Org**.
- The top bar replaces a simple “Exit demo” pattern with **Change view**, which opens options:
  - **Exit Demo View**
  - **See as Brand**
  - **See as Student Org**

This allows internal stakeholders to switch personas quickly without implying that production users can do the same.

**Implementation note:** Demo access is gated (e.g. passcode / feature flag). See application config for the current demo access mechanism.

---

## 4. Drops — shared concepts

### 4.1 Capacity & application window (timing)

Each drop has a **fixed maximum number of organization spots** (e.g. 10). Drops may also carry an **optional total product unit budget** (`total_product_units` — **nullable** when units are unknown or not applicable at request time) that brands distribute across approved orgs during applicant selection (**§7.1**). Multiple orgs may **apply**. Applicant review and outcomes: **§7.1**. When brand-approved orgs **fill** all spots, the drop shows as **Closed** on the org **Drop Feed** for new Open applications (**§7.2**).

For v1, drops expose two timestamps:

| Field            | Purpose                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `apply_open_at`  | When applications open; drives **Upcoming** → **Open** transition for org UX and countdown before open. |
| `apply_close_at` | When the application window ends.                                                                       |

**Timing outcomes:** If `apply_close_at` passes before all spots are filled, the drop **auto-closes** (no new applications under the open window). After auto-close or any other closure, **Buzz** may **manually reopen** (admin UX TBD). These timestamps also drive org feed states (**§6.3**).

### 4.2 Post attribution (hard constraint)

- A single **social media post** (one canonical post identity on a platform) may be linked to **at most one** campaign (one org’s participation in one drop).
- The system must prevent double-assignment across campaigns.

### 4.3 Metrics

- Likes, comments, and related engagement metrics are **refreshed periodically** (not a one-time snapshot at submission).
- **Estimated reach (v1 definition):** Derived from **follower counts** of the participating student org(s) (and/or connected accounts as implemented), combined with product rules for display.
- **Aggregate likes:** Show **aggregate likes** across the campaign’s linked posts (in addition to or alongside estimated reach, per product copy).
- Brand-facing layout (per-org, UGC, roll-ups): **§5.3**.

---

## 5. Brand experience (PLS)

### 5.1 Onboarding

1. Brand submits **company information** and a **short message** (intent / context for Buzz).
2. A Buzz representative **manually reviews** the submission.
3. Upon approval, the brand is **onboarded** into the Brand portal.

**Interaction notes:**

- Brand does not self-configure drop logistics in a PLG sense; the rep is the operational owner.

### 5.2 Requesting a drop

1. Brand submits a **drop request**.
2. A Buzz representative handles **agreements, logistics, product shipment, and scheduling** behind the scenes.
3. The brand sees a **read-only status tracker** for these high-level stages (Buzz updates them).

**Brand-facing tracker stages (canonical order):**

1. **Request Received** — _A representative will contact you soon_
2. **Finalizing Agreements** — _Contracts being processed_
3. **Awaiting Products** — _Shipped — tracking number shown_ (when applicable)
4. **Drop Active** — _Campaign is live_
5. **Drop Finished** — _Campaign complete_

**Interactions:**

- Brand users **cannot** advance these tracker stages themselves.
- Tracking number appears when relevant at **Awaiting Products** (and may remain visible where product copy dictates).

#### 5.2.1 Logistics integrations (e.g. EasyPost)

Buzz integrates **shipping and tracking** with external providers (for example **EasyPost**) so brands can **enter or sync tracking numbers**, and eventually **generate labels** and receive **webhook-driven** carrier events (e.g. in transit, delivered) where the implementation supports it.

**NOTE:** Exact split of responsibilities (Buzz vs. brand vs. automation) for each milestone should follow the same tracker UX unless the product explicitly hands a step to the brand through the integration.

**TODO:** Finalize EasyPost (or vendor) scope — API keys, webhook surface, who may purchase labels, rate shopping, multi-package drops, org-facing vs. brand-facing tracking parity, and error handling.

### 5.3 Brand dashboard — two views

#### 5.3.1 Per-drop view

When a drop is **active** or **finished**, the brand can open it and sees:

- **Applicants and participants by organization:** Each applying org appears as its own row (or card) so the brand can **approve** or **deny** applicants up to the drop’s capacity. Approved orgs remain visible for the lifecycle of the drop.
- **All social posts** linked or submitted for the drop, **grouped by org** where useful, plus roll-up summaries across the drop.
- **Per-post metrics:** likes, comments, estimated reach (per implementation), aligned with platform analytics where applicable.
- **Drop-level KPIs:** total engagement, total reach, **cost per engagement** (if cost inputs exist in the product; otherwise hide or N/A per implementation).

**UGC library (per drop or linked surface):** A single place for the brand to **preview** posts, Reels, and photos contributed for that drop and to **download** approved assets for reuse in the brand’s own marketing.

**TODO (UGC):** Usage rights, consent scope, watermarking, export formats, retention, and moderation / takedown — product and legal to define.

**Interactions:**

- Read-only analytics exploration (filters, date ranges, etc. are optional v2+ unless specified).
- **Applicant decisions** are brand actions (approve / deny); analytics and library browsing remain read-only except where downloads are explicitly offered.

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

1. Org user chooses **Login with Instagram** (creates or signs into a Buzz account tied to that Instagram identity).
2. The app collects **university**, **org name**, and a **university .edu email** address (must match the org’s campus).
3. Buzz sends a **verification** to that **.edu** address; the user completes verification.
4. After **verified .edu** email, the org enters **pending Buzz review** — a Buzz admin manually reviews the org and **approves** or **denies** it.
5. After **Buzz approval**, the user is **granted access** to the Organization portal (Drop Feed, My Campaigns). Denied applicants are notified by **email** and do not gain portal access.

**Access gate:** Portal features are unavailable until step 5 completes. Neither Instagram login nor `.edu` verification alone grants access — Buzz admin approval is required.

**Additional platforms:** Campaign post selection (**§6.4.2**) may require connecting other supported accounts (e.g. TikTok) in addition to the Instagram identity used at login.

### 6.2 Pages

Orgs have **two separate** surfaces:

1. **Drop Feed** — discovery and application; **not** mixed with history.
2. **My Campaigns** — participation history and active campaign management.

---

### 6.3 Drop Feed page

**Purpose:** Browsable catalog of **available** and **upcoming** drops.

Each **drop card** shows:

- Drop details and **brand** identity (as permitted by product).
- **Spots:** e.g. _“4 of 10 spots remaining”_ (or equivalent copy).
- **Status** for org UX: **Upcoming**, **Open**, **Closed**.

#### 6.3.1 Status: Upcoming

- Before `apply_open_at`, the drop is **Upcoming**.
- Show a **live countdown** to `apply_open_at`.
- **Notify Me** button:
  - **v1:** Persisted **server-side** as a per-org, per-drop subscription; shows confirmation: _“You’re on the list — we’ll let you know when this opens.”_
  - **Later:** Active notification delivery (email / push) driven from the same subscription records.

**Interactions:**

- Tapping **Notify Me** records the subscription on the backend; revisits show the already-subscribed state from the server.
- Org may opt out (remove the subscription) before `apply_open_at`.

#### 6.3.2 Status: Open

- After `apply_open_at` and before closure conditions, the drop is **Open** (subject to `apply_close_at` and not closed for other reasons — **§4.1**).
- **Apply:** If the drop is open under those rules and spots remain, org can submit an application (**§7.1**). At capacity on the feed: **§7.2**.

#### 6.3.3 Status: Closed

- **Closed** when: `apply_close_at` has passed, capacity is filled per **§7.2**, Buzz manually closed the drop, or other admin actions. **Reopen:** **§4.1**.

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

**No waitlist** — each applicant is either pending review, approved, or denied.

1. Org submits **Apply** on an **Open** drop (if allowed by time + state; **§4.1**, **§6.3**).
2. The **brand** reviews applications for that drop.
3. The brand **approves** or **denies** each applicant:
   - **Approved** — counts toward capacity; if the drop has a `total_product_units` budget (**§4.1**), the brand also **allocates units per approved org**, with the sum of allocations capped by the budget. Org moves to **Accepted** in **My Campaigns** when product rules expose that state (subject to fulfillment and activation).
   - **Denied** — **no** row in **My Campaigns** for that application; **email** only.

### 7.2 Capacity exhaustion

- When brand-**approved** orgs **fill** all spots:
  - Drop shows as **Closed** on the **Drop Feed** (org cannot apply as Open).

### 7.3 Concurrent participation

- An org **may** hold **brand-approved** spots on **multiple drops** simultaneously.
- Any **future** limits (e.g. max concurrent campaigns) are **TBD by Buzz** and not enforced in this v1 spec unless added later.

---

## 8. Data flow and aggregation

```
Multiple orgs submit post links for the same drop
              ↓
Brand approves or denies each applicant (§7.1)
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

- **Brand:** Approve/deny drop applicants (**§7.1**). Org moves **Applied → Accepted** after brand approval (labels may differ by surface).
- **Buzz:** Brand **platform** onboarding; **drop-request** tracker stages (**§5.2**); agreements and ops coordination; **§4.1** reopen; **org** lifecycle beyond applicant choice (e.g. **Active** / **Finished** when fulfillment and campaign rules are met — triggers TBD with brands). Org **portal access** is gated by **.edu** verification **followed by Buzz admin approval** (**§6.1**).
- **Automation / rules:** Feed **Open/Closed** follows **§4.1**, **§6.3**, **§7.2**.

---

## 10. Interaction matrix (quick reference)

| Actor | Surface             | Primary actions                                                                                                                  |
| ----- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Brand | Onboarding          | Submit info + message; wait for rep                                                                                              |
| Brand | Drop request        | Submit request; view read-only tracker                                                                                           |
| Brand | Per-drop dashboard  | Approve/deny applicants by org; per-org posts + metrics; drop KPIs; UGC preview/download                                         |
| Brand | Aggregate dashboard | Totals, time series, compare drops, running totals                                                                               |
| Org   | Onboarding          | Login with Instagram; university + org name + **.edu**; verify email → access                                                    |
| Org   | Drop Feed           | Browse; countdown + Notify Me (local); Apply                                                                                     |
| Org   | My Campaigns        | Track status; manage posts when Active                                                                                           |
| Buzz  | Admin (conceptual)  | Platform org/brand onboarding; move brand tracker stages; timing/reopen/fulfillment coordination; integrations (see §5.2.1 TODO) |

---

## 11. Non-goals and v1 scope boundaries

- **Notify Me delivery (email / push):** Out of scope for v1 — only the subscription record is persisted; active delivery is deferred.
- **In-app denial UI for orgs:** Out of scope — channel is **email**; rules **§7.1** (drop applicant denials).
- **Rich drop scheduling beyond apply window:** Only `apply_open_at` and `apply_close_at` specified for v1; other timestamps may be implicit inside Buzz ops.

---

## 12. Open product decisions (explicitly TBD)

- Future **policy limits** on how many concurrent drops an org may hold.
- Exact **cost per engagement** inputs and formulas.
- Admin tooling UX for **reopen**, exception handling, and Buzz override paths (if any) when a brand is unresponsive.
- Whether **tracking numbers** surface in multiple places simultaneously (brand tracker vs. org campaign).
- Shipping (**§5.2.1** TODO) and **UGC** policy (**§5.3.1** TODO): detail lives in those subsections, not duplicated here.
