# Buzz — Product Specification

This document describes Buzz’s product architecture, user experiences, lifecycle rules, data flow, and interactions. It reflects the intended behavior for the current product direction (including demo-specific affordances).

---

## 1. Executive summary

Buzz serves **two separate platform experiences** that intentionally do not overlap for real users:

| Dimension | Brands | Student organizations |
|-----------|--------|------------------------|
| Go-to-market | Sales-led (PLS) | Product-led (PLG) |
| Onboarding | Sales-assisted; Buzz reviews and onboards | Self-serve application; Buzz accepts or denies |
| Scheduling / participation | Buzz representative handles execution behind the scenes | Orgs discover drops, apply (or waitlist), subject to capacity |
| Primary portal | Status tracker + KPI dashboards | Drop feed + campaign history |
| Analytics lens | Per-drop, aggregate across drops, engagement over time | Own posts + aggregate engagement per active campaign |
| Motion | Representative-driven | Self-serve application flow |

**Key product rule:** A real user belongs to **exactly one** portal (Brand **or** Organization). **Demo users** with demo access may switch views for presentation purposes.

---

## 2. Terminology

- **Brand:** A company partner using Buzz in a sales-assisted model.
- **Organization (Org):** A student organization using Buzz in a self-serve model.
- **Drop:** A campaign instance with capacity, application windows, and lifecycle states visible differently to brands vs. orgs.
- **Campaign (org context):** An org’s participation in a specific drop (application through completion).
- **Spot:** One org slot in a drop’s fixed capacity.
- **Buzz / Admin:** Internal operators who move statuses, manage agreements, products, and acceptance decisions.

---

## 3. Access and identity

### 3.1 Production behavior

- No end user may belong to **both** the Brand portal and the Organization portal.
- Routing and permissions enforce a **single portal** per authenticated user.

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

### 4.1 Capacity

- Each drop has a **fixed maximum number of organization spots** (e.g. 10).
- Multiple orgs may **apply**.
- Buzz accepts orgs **up to** the capacity limit.
- When all spots are **filled by accepted orgs**, the drop is **closed** on the **Drop Feed** (orgs can no longer apply as “Open”).
- Orgs may **opt into a waitlist** when the drop is full (spots exhausted but Buzz may still manage the list administratively).

### 4.2 Application window (timing)

For v1, drops expose two timestamps:

| Field | Purpose |
|-------|---------|
| `apply_open_at` | When applications open; drives **Upcoming** → **Open** transition for org UX and countdown before open. |
| `apply_close_at` | When the application window ends. |

**Auto-close rule:** If `apply_close_at` passes **before** all spots are filled, the drop **automatically closes** (applications no longer accepted under the open window). Buzz may **manually reopen** the drop later if business needs require it.

**Manual reopen:** After auto-close (or any close), internal operators can reopen; exact admin UX is product/engineering detail, but the rule is: **closure can be overridden manually**.

### 4.3 Post attribution (hard constraint)

- A single **social media post** (one canonical post identity on a platform) may be linked to **at most one** campaign (one org’s participation in one drop).
- The system must prevent double-assignment across campaigns.

### 4.4 Metrics

- Likes, comments, and related engagement metrics are **refreshed periodically** (not a one-time snapshot at submission).
- **Estimated reach (v1 definition):** Derived from **follower counts** of the participating student org(s) (and/or connected accounts as implemented), combined with product rules for display.
- **Aggregate likes:** Show **aggregate likes** across the campaign’s linked posts (in addition to or alongside estimated reach, per product copy).
- Brand-facing views aggregate from post → drop → all drops without exposing per-org breakdown in v1 (see §7).

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
3. The brand sees a **read-only status tracker** (Buzz updates stages).

**Brand-facing tracker stages (canonical order):**

1. **Request Received** — *A representative will contact you soon*
2. **Finalizing Agreements** — *Contracts being processed*
3. **Awaiting Products** — *Shipped — tracking number shown* (when applicable)
4. **Drop Active** — *Campaign is live*
5. **Drop Finished** — *Campaign complete*

**Interactions:**

- Brand users **cannot** advance stages themselves.
- Tracking number appears when relevant at **Awaiting Products** (and may remain visible where product copy dictates).

### 5.3 Brand dashboard — two views

#### 5.3.1 Per-drop view

When a drop is **active** or **finished**, the brand can open it and sees:

- **All social posts** submitted across **every** participating org (rolled up; **no per-org breakdown** in v1).
- **Per-post metrics:** likes, comments, estimated reach (per implementation).
- **Drop-level KPIs:** total engagement, total reach, **cost per engagement** (if cost inputs exist in the product; otherwise hide or N/A per implementation).

**Interactions:**

- Read-only analytics exploration (filters, date ranges, etc. are optional v2+ unless specified).
- No org-level drill-down in v1.

#### 5.3.2 Aggregate dashboard

A separate **high-level** view across **all** the brand’s drops:

- **Total reach** and **total engagement** across campaigns.
- **Engagement over time** — chart tracking performance **across drops** (time series).
- **Compare drops** — comparative view (table, chart, or cards — implementation detail).
- **Running totals** — e.g. posts submitted, orgs involved, campuses reached (definitions depend on data captured).

**Interactions:**

- Brand selects time ranges or drops to compare (if offered).
- All data is **aggregated**; still **no per-org breakdown** in v1.

---

## 6. Organization experience (PLG)

### 6.1 Onboarding

1. Organization **applies** to join Buzz (self-serve).
2. Buzz **accepts** or **denies** the application.
3. If accepted, the org **connects Instagram and/or TikTok** (as supported).

**Denial behavior:**

- **No** denial state is shown in the org UI.
- The org is notified via **email** only.

### 6.2 Two primary pages

Orgs have **two separate** surfaces:

1. **Drop Feed** — discovery and application; **not** mixed with history.
2. **My Campaigns** — participation history and active campaign management.

---

### 6.3 Drop Feed page

**Purpose:** Browsable catalog of **available** and **upcoming** drops.

Each **drop card** shows:

- Drop details and **brand** identity (as permitted by product).
- **Spots:** e.g. *“4 of 10 spots remaining”* (or equivalent copy).
- **Status** for org UX: **Upcoming**, **Open**, **Closed**.

#### 6.3.1 Status: Upcoming

- Before `apply_open_at`, the drop is **Upcoming**.
- Show a **live countdown** to `apply_open_at`.
- **Notify Me** button:
  - **v1:** Client-side only — preference stored in **localStorage**; shows confirmation: *“You’re on the list — we’ll let you know when this opens.”*
  - **Later:** Persisted server-side with notifications.

**Interactions:**

- Tapping **Notify Me** does **not** call the backend in v1.
- Revisit behavior: localStorage can suppress duplicate prompts or show “already notified” state (implementation detail).

#### 6.3.2 Status: Open

- After `apply_open_at` and before closure conditions, the drop is **Open** (subject to `apply_close_at` and not closed for other reasons).
- **Apply** button:
  - If spots remain (under product rules for “open”), org can **apply**.
  - Buzz (admin) accepts/denies/waitlists applicants.

**Full capacity / waitlist:**

- If the drop is **full** (no spots left for new acceptances), orgs can **opt into the waitlist** from the feed (or apply flow — exact control placement is UX detail).
- Waitlisted participation appears in **My Campaigns** (see §6.4).

#### 6.3.3 Status: Closed

- Closed when:
  - `apply_close_at` has passed (**auto-close** even if spots unfilled), **or**
  - All spots are filled and product rules mark the drop closed on the feed, **or**
  - Buzz manually closed (if applicable), **or**
  - Other admin actions.

**Reopen:**

- Buzz may **manually reopen** after auto-close or other closure.

**Interactions:**

- **Apply** is not available.
- **Notify Me** may be hidden or irrelevant depending on state (product decision: typically only for Upcoming).

---

### 6.4 My Campaigns page

**Purpose:** History of all drops the org has **interacted with** (applications, acceptances, waitlist, active, finished — see below).

- **Sort:** Active campaigns **first**, then others (e.g. by recency).

#### 6.4.1 Org-facing campaign stages

Each campaign shows a **status** in this progression:

1. **Applied**
2. **Accepted** — *Awaiting product* (tracking number shown when available)
3. **Active** — *Drop is live*
4. **Finished**

**Additional visibility:**

- **Waitlist** — If the org opted into the waitlist for a drop, that relationship **appears** in My Campaigns as waitlisted (exact label/styling is UX detail).

**Denial:**

- If an org is **denied**, **nothing** is shown in My Campaigns; **email** is the channel.

**Interactions:**

- Tap a campaign to open **campaign detail** appropriate to status.

#### 6.4.2 When a campaign is Active — campaign detail

The org can:

- **Select** which of **their** social posts **relate to this drop** (subject to the **one-post-one-campaign** rule).
- See an **aggregate engagement score** across all **selected** posts for that campaign.

**Data flow implication:**

- That aggregate feeds **directly into** the **brand’s per-drop dashboard** (along with other orgs’ contributions), still **without per-org breakdown** for the brand in v1.

---

## 7. Applications, acceptance, and capacity — rules

### 7.1 Application flow (org → Buzz)

1. Org submits **Apply** on an **Open** drop (if allowed by time + state).
2. Buzz reviews applications.
3. Buzz may:
   - **Accept** (up to capacity),
   - **Deny** (org sees nothing in app; email sent),
   - **Waitlist** (visible in My Campaigns for org).

### 7.2 Capacity exhaustion

- When accepted orgs **fill** all spots:
  - Drop shows as **Closed** on the **Drop Feed** (org cannot apply as Open).
  - Waitlist may still be offered **if** product allows opt-in after fill (specified: orgs **can** opt into waitlist when full).

### 7.3 Concurrent participation

- An org **may** be **accepted to multiple drops** simultaneously.
- Any **future** limits (e.g. max concurrent campaigns) are **TBD by Buzz** and not enforced in this v1 spec unless added later.

### 7.4 Timing and auto-close

- **`apply_open_at`:** Countdown in Upcoming; gate for Open.
- **`apply_close_at`:** When passed, applications **auto-close** even if spots remain.
- **Manual reopen** allowed after auto-close.

---

## 8. Data flow and aggregation

```
Multiple orgs submit post links for the same drop
              ↓
Buzz pulls / refreshes metrics per post (likes, comments, reach estimates)
              ↓
Aggregated per drop  →  Brand per-drop view (no per-org breakdown in v1)
Aggregated all drops →  Brand aggregate dashboard
                     →  Engagement over time chart
```

**Org-visible data:**

- Org sees **its own** posts and **its** aggregate for the campaign.
- Org does **not** see other orgs’ posts or brand-global totals (unless explicitly added later).

---

## 9. Status authority

- **Buzz (internal)** is the **sole authority** for advancing or changing meaningful statuses on both sides:
  - Brand drop tracker stages.
  - Org campaign stages (Applied / Accepted / Active / Finished / Waitlist).
- Automated rules still apply where specified:
  - Drop feed **Open/Closed** behavior driven by `apply_open_at`, `apply_close_at`, fill, and admin reopen.

---

## 10. Interaction matrix (quick reference)

| Actor | Surface | Primary actions |
|-------|---------|-----------------|
| Brand | Onboarding | Submit info + message; wait for rep |
| Brand | Drop request | Submit request; view read-only tracker |
| Brand | Per-drop dashboard | View posts (aggregated), per-post metrics, drop KPIs |
| Brand | Aggregate dashboard | Totals, time series, compare drops, running totals |
| Org | Onboarding | Apply; connect IG/TikTok if accepted |
| Org | Drop Feed | Browse; countdown + Notify Me (local); Apply; waitlist if full |
| Org | My Campaigns | Track status; manage posts when Active |
| Buzz | Admin (conceptual) | Accept/deny/waitlist; move brand stages; manage timing/reopen; fulfillment |

---

## 11. Non-goals and v1 scope boundaries

- **Per-org visibility for brands:** Out of scope for v1.
- **Notify Me backend:** Out of scope for v1 (localStorage only).
- **Denial in org app:** Out of scope (email only).
- **Unified portal for real users:** Out of scope (single portal per user).
- **Rich drop scheduling beyond apply window:** Only `apply_open_at` and `apply_close_at` specified for v1; other timestamps may be implicit inside Buzz ops.

---

## 12. Open product decisions (explicitly TBD)

- Future **policy limits** on how many concurrent drops an org may hold.
- Exact **cost per engagement** inputs and formulas.
- Admin tooling UX for **reopen**, waitlist management, and exception handling.
- Whether **tracking numbers** surface in multiple places simultaneously (brand tracker vs. org campaign).

---

*Last updated to reflect: waitlist visible in My Campaigns; auto-close at `apply_close_at` with manual reopen; clarified metrics, attribution, demo view switching, and denial handling.*
