---
id: product.capacity-closed-during-open-unreachable
title: PRODUCT capacity-Closed during Open is unreachable
kind: doc_drift
severity: P2
status: fixed
closed_in: 310712e
surface: product
evidence:
  - path: PRODUCT.md
    note: §4.1 / §6.3 / §7.2 claim capacity fill closes feed during Open; §7.1 reads as rolling approve
  - path: backend/app/services/brands.py
    note: finalize_applicants requires now > apply_close_at (APPLY_WINDOW_OPEN); only accept write path
  - path: frontend/src/pages/brand/BrandDropDetailPage.tsx
    note: canEditSelection mirrors API — finalize UI hidden until after close
  - path: frontend/src/utils/dropStatus.ts
    note: Closed if acceptedCount >= capacityTotal — machinery works; first-window acceptedCount stays 0
  - path: frontend/src/components/org/DropFeedCard.tsx
    note: spots copy implies fill-during-Open; first window always shows N of N remaining
  - path: backend/tests/test_brand_routes.py
    note: test_apply_window_still_open pins APPLY_WINDOW_OPEN
repro: |
  1. Drop capacity=10, open window in progress, stage request_received.
  2. Orgs apply; GET /api/drops → acceptedCount=0; card "10 of 10 spots remaining", Open.
  3. Brand finalize while now <= apply_close_at → 400 APPLY_WINDOW_OPEN; SPA hides finalize table.
  4. After apply_close_at (+ autoclose → finalizing_agreements), finalize 10 → Closed.
  Optional: finalize 3/10 → admin reopen → Open with "7 of 10 remaining" (proves §7.2 machinery; first-window fill still impossible).
fix_when: |
  Fork A complete only: PRODUCT §4.1, §5.3.1, §6.3 (including the intro card
  “spots remaining” example), §6.3.2–6.3.3, §7.1–7.2, §8–§9 (and related
  glossary / matrix lines) state collect-all-then-batch-finalize after
  apply_close_at; capacity-Closed is not claimed during the first Open window;
  org Open spots copy is "Up to N spots" when acceptedCount === 0, and
  "M of N spots remaining" when acceptedCount > 0 (reopen leftovers; capacity-
  Closed chip when full); dropStatus.ts / DropFeedCard comments no longer cite
  mid-window §7.2 fill fiction. FE unit/RTL covers both Open copy branches
  (do not assume existing tests). Backend finalize/apply behavior unchanged.
  Archive when those doc + copy + comment edits land.
---

## Problem

PRODUCT still claims mid-window capacity-Closed (§4.1 / §6.3 / §7.2): when
brand-approved orgs fill all spots, the feed shows Closed for new applies —
including while the chronological Open window is still running. §7.1 / §5.3.1
also read as rolling per-applicant approve.

Shipped code is intentional **batch finalize after `apply_close_at`**. The only
path that writes `decision=accepted` is `finalize_applicants`, which raises
`APPLY_WINDOW_OPEN` while the window is open. Brand SPA mirrors that gate.
During a normal first Open window `acceptedCount` stays **0**, so spots never
decrease and capacity-Closed is unreachable.

## Assessment

~**90% doc_drift / ~10% ux_hole**. Runtime apply/finalize is consistent under
the batch-after-close model — not a broken authz or integrity path. Org feed
spots copy is mildly misleading (implies fill-during-Open).

**Severity softened P1 → P2.** Parked in `gaps/CLUSTERS.md` until explicitly
un-parked; **v1 fix is locked to Fork A** (docs + copy + comments).

**Nuance:** After finalize + admin reopen with prior accepts, spots *can*
decrease (and spots_filled Closed can occur) while apply is open via
`manual_reopen`. That is a secondary round — not PRODUCT’s first-window story.
Do not claim “acceptedCount stays 0 on all product paths.”

## Locked v1 fix (Fork A)

Match PRODUCT (and org-facing copy/comments) to shipped **batch finalize after
`apply_close_at`**. Do not change runtime accept/finalize gates.

### 1. PRODUCT.md sections to rewrite

Rewrite these so they no longer claim mid-window rolling approve or first-window
capacity-Closed. Proposed rules (use this wording or equivalent):

- **§4.1 Capacity & application window**
  - Keep fixed org capacity and optional `total_product_units`.
  - **During Open:** orgs may **apply** only; applications stay pending review.
  - Brand **accept / deny** happens in a **batch finalize after `apply_close_at`**
    (see §7.1) — not while the chronological window is still open.
  - Remove / replace the sentence that brand-approved orgs filling spots closes
    the feed **during** Open. Capacity-Closed belongs to **§7.2** as
    post-selection (or reopen leftovers), not a first-window Open outcome.
  - Timing: if `apply_close_at` passes, the window **auto-closes** (no new
    applies under the open window). Buzz may **manually reopen** (§4.1).

- **§5.3.1 Per-drop view**
  - Applicant approve/deny is available when the drop is in the post-window
    selection stage (`finalizing_agreements` / equivalent), **not** framed as
    rolling decisions on every “active or finished” drop during Open.
  - Proposed: brands **finalize** applicants **after the application window
    closes**, approving or denying up to capacity (with unit allocation when
    budgeted).

- **§6.3 intro / card bullet** (PRODUCT ~“4 of 10 spots remaining” example)
  — **must** rewrite to match conditional copy (`Up to N` / reopen `M of N`),
  not only §6.3.2–6.3.3 subsections.
- **§6.3.2 Open**
  - Open = after `apply_open_at`, before `apply_close_at` (and not otherwise
    closed). Orgs may **Apply** while Open.
  - Spots line: first Open (`acceptedCount === 0`) does **not** imply depleting
    accepts; reopen with prior accepts may show remaining spots (see §2 copy).
  - At capacity on the feed refers to **§7.2** post-selection / reopen — not
    mid-window accepts.

- **§6.3.3 Closed**
  - **Closed** when: `apply_close_at` has passed (unless manually reopened),
    capacity is filled per **§7.2** (after selection, or reopen with prior
    accepts), Buzz manually closed the drop, or other admin actions.
  - Do not imply capacity fill alone closes a first-window Open drop before
    finalize.

- **§7.1 Application flow**
  - Collect-all-then-pick: (1) Org applies while Open. (2) After
    `apply_close_at`, brand **batch-finalizes**: approve or deny each applicant
    up to capacity (allocate units if budgeted). (3) Approved → Accepted in My
    Campaigns per product rules; Denied → email only, no My Campaigns row.
  - Explicit: **no accept writes while `now <= apply_close_at`** in v1.

- **§7.2 Capacity exhaustion**
  - When brand-**approved** orgs (via finalize) **fill** all spots, the Drop
    Feed shows **Closed** for new applies (no waitlist).
  - That Closed state is **post-selection**, or on a **reopened** window with
    prior accepts already counting toward capacity — **not** a first-window
    Open path.

- **§8 data-flow diagram / §9 Status authority / §10 matrix / glossary**
  - Align “Brand approves applicants” with **batch finalize after close**, not
    rolling mid-window approve. Feed Open/Closed automation still cites
    §4.1 / §6.3 / §7.2 under the rewritten meanings.

### 2. Org feed spots copy

**File:** `frontend/src/components/org/DropFeedCard.tsx` (Open calendar line).

Always-“Up to N” understates **reopen** rounds where prior accepts leave
`acceptedCount > 0`. Lock conditional Open copy:

| Condition | Locked Open spots line |
| --- | --- |
| `acceptedCount === 0` (first window / no prior accepts) | `` `Up to ${drop.capacityTotal} spots` `` |
| `acceptedCount > 0` and not full (reopen leftovers) | `` `${remaining} of ${drop.capacityTotal} spots remaining` `` |
| full (`acceptedCount >= capacityTotal`) | existing capacity-Closed path / chip (`CLOSED_REASON_COPY` / “Spots filled”) — unchanged |

Do not invent applied-count UI in this gap. First-window Open stays honest
(“Up to N”); reopen leftovers keep depleting “M of N remaining.”

### 3. Code comments citing §7.2 fiction — **in**

Update comments so they describe **post-selection / reopen** capacity-Closed,
not mid-window fill during first Open:

- **`frontend/src/utils/dropStatus.ts`** — file header: keep
  `acceptedCount >= capacityTotal` → Closed as implemented machinery; clarify
  that in the normal first Open window `acceptedCount` stays 0 until batch
  finalize after close (PRODUCT §7.1–7.2 after Fork A rewrite).
- **`frontend/src/components/org/DropFeedCard.tsx`** — module docstring and the
  inline `// PRODUCT.md §7.2` on the Open+full branch: reword so §7.2 means
  capacity-Closed after finalize (or reopen leftovers), not “spots fill while
  the Open window is still running.”

### 4. What NOT to change (backend finalize / apply)

- Do **not** relax `APPLY_WINDOW_OPEN` / `finalize_applicants` timing gate.
- Do **not** add mid-window accept writes or alternate accept paths.
- Do **not** change brand SPA `canEditSelection` / finalize visibility to allow
  selection during Open.
- Do **not** change apply `CAPACITY_EXCEEDED` semantics to depend on
  mid-window accepts.
- Keep `test_apply_window_still_open` (and equivalent) green — gate stays.

### 5. Tests / docs checklist

- [ ] PRODUCT.md sections in §1 above rewritten **including §6.3 intro card
      spots example**; no remaining claim that first-window Open capacity fill
      closes the feed via mid-window accepts.
- [ ] `DropFeedCard` Open spots: `acceptedCount === 0` → `Up to ${capacityTotal}
      spots`; `acceptedCount > 0` → keep `${remaining} of ${capacityTotal} spots
      remaining` (full → existing Closed chip / `Closed — all spots filled`).
      **Add** unit/RTL coverage for both Open branches (smoke mount alone is
      insufficient today). Leave dead `open && full` button alone aside from
      planned §7.2 comment reword.
- [ ] `dropStatus.ts` + `DropFeedCard` comments updated (item 3).
- [ ] Confirm backend apply/finalize tests still pin `APPLY_WINDOW_OPEN` (no
      new mid-window finalize tests as part of this gap).
- [ ] Grep PRODUCT / UI strings for “spots remaining” / “fill all spots” during
      Open fiction; clean stragglers.
- [ ] No requirement to change E2E finalize-after-close behavior for this gap.

### 6. `fix_when`

See frontmatter: Fork A doc + spots copy + comment edits only. Backend
finalize/apply unchanged.

## Out of scope: Fork B

**Mid-window accept** (relax `APPLY_WINDOW_OPEN`, selection UI during Open,
rising `acceptedCount` / first-window capacity-Closed) is a **future product
change — out of scope** for this gap and for v1 unless explicitly **un-parked**
with a product decision. If pursued later, open a **new gap** for mid-window
accept (stage / email / race / E2E surface); do not reopen this file as an A-vs-B
choice.

## Plan verification

**Verdict: PASS_WITH_NITS**

Docs + org spots copy + comment alignment (Fork A) is the right fix. Conditional
Open copy is feasible and correctly locked. Backend-untouched is correct. Nits
are rewrite-target clarity and test/dead-path precision — not scope or approach
flaws. Do not rewrite PRODUCT in this verification pass.

### Evidence checked

| Claim | Reality |
| --- | --- |
| Mid-window capacity-Closed unreachable on first Open | Confirmed. Only accept write is `finalize_applicants` (`backend/app/services/brands.py`); gate `now <= apply_close_at` → `APPLY_WINDOW_OPEN`. Brand SPA `canEditSelection` mirrors post-close / `finalizing_agreements`. First-window `acceptedCount` stays 0. |
| Capacity-Closed machinery exists | Confirmed. `getDropFeedStatus` / apply path both treat `acceptedCount >= capacityTotal` as closed / `CAPACITY_EXCEEDED`. |
| Reopen leftovers can deplete spots while Open | Confirmed. `reopen_drop` clears `applicant_selection_finalized_at` (pre-live) and sets `manual_reopen`; prior accepts remain. Open + `acceptedCount > 0` is a real secondary path. |
| Current org Open copy implies fill-during-Open | Confirmed. `DropFeedCard` always renders `` `${remaining} of ${capacityTotal} spots remaining` `` when Open → first window shows e.g. `10 of 10 spots remaining`. |
| PRODUCT drift | Confirmed. §4.1 ties fill → Closed for “new Open applications”; §6.3 card example is depleting “4 of 10 remaining”; §5.3.1 / §7.1 read as rolling approve on active/finished without batch-after-close; §7.2 does not locate Closed as post-selection/reopen. |

### Is docs+copy-only complete/correct?

**Yes for Fork A as locked.** Runtime apply/finalize is already consistent under
batch-after-close. The hole is PRODUCT + org-facing first-window copy + comments
that still narrate mid-window fill. Matching docs/copy to shipped behavior
closes the gap without Fork B (mid-window accept).

Fork A scope (PRODUCT rewrite + conditional Open spots line + `dropStatus` /
`DropFeedCard` comments; no backend / no `canEditSelection` relaxation) matches
`fix_when` and Out of scope: Fork B.

### Conditional spots copy — feasible?

**Yes.** `acceptedCount` is already a `DropFeedCard` prop (feed row from API).
Change is local to the Open calendar branch (~L124).

| Condition | Feasible? | Notes |
| --- | --- | --- |
| `acceptedCount === 0` → `Up to ${capacityTotal} spots` | Yes | Normal first Open; honest non-depleting copy. |
| `acceptedCount > 0` && not full → `M of N spots remaining` | Yes | Reopen leftovers only under current gates; keeps depleting copy where true. |
| full → existing Closed path | Yes | `getDropFeedStatus` returns `"closed"` when full **before** Open — capacity-Closed is the Closed calendar/`CLOSED_REASON_COPY.spots_filled` path, not a live Open state. |

Always-“Up to N” would be wrong on reopen; plan correctly locks the conditional.

**Nit:** Plan table’s full row cites `CLOSED_REASON_COPY` / “Spots filled”. Precise
shipped Closed calendar string is `Closed — all spots filled`. The
`feedStatus === "open" && full` “Spots filled” button is **dead** under
`getDropFeedStatus` (full ⇒ `"closed"`). Fork A should leave that branch alone
(or only reword its §7.2 comment as planned); do not treat it as the primary
capacity-Closed UX.

### Backend untouched — OK?

**Yes.** Do not touch `APPLY_WINDOW_OPEN`, accept writes, apply
`CAPACITY_EXCEEDED`, or brand finalize visibility. Those already implement
batch-after-close. Reopen + prior accepts already exercise depleting spots /
spots_filled Closed without mid-window accept. Keeping
`test_apply_window_still_open` green is the right regression pin.

Optional comment-only on `backend/app/schemas/drops.py` (“spots remaining”) is
out of Fork A’s listed files; frontend comment pass is enough unless a later
grep wants schema docstring soft-alignment.

### PRODUCT sections — missed drift?

Plan lists §4.1, §5.3.1, §6.3.2–6.3.3, §7.1–7.2, §8–§9, §10 matrix, glossary —
correct core. Checklist grep for “spots remaining” / fill-during-Open fiction
is the backstop.

**Nits — amended into Locked / fix_when (2026-08-06):** §6.3 intro card
example called out; FE unit tests for both Open branches required; dead
`open && full` button left alone.

No PRODUCT section outside Fork A’s umbrella **requires** a separate product
decision for this gap. Legal `TermsPage.tsx` approve/deny line is out of scope.

### Implementation nits (non-blocking)

- Checklist says “Update frontend tests”; today only `smoke.test.tsx` mounts
  `DropFeedCard` (no copy assert). **Add** unit/RTL coverage for both Open
  branches (acceptedCount 0 vs >0), don’t assume they exist.
- Reword `dropStatus.ts` header + `DropFeedCard` module/§7.2 comments as
  planned; optional soft note on `types/drop.ts` `acceptedCount` JSDoc.
- `FeedStatusChip` “Full” on `open && full` is equally dead; out of scope
  unless touching that file for comments anyway.

### What would FAIL this plan

- Requiring Fork B / relaxing `APPLY_WINDOW_OPEN` under this gap id.
- Always-“Up to N” without the reopen branch.
- PRODUCT-only with no Open spots copy change (leaves UX fiction).
- Claiming backend must change for Fork A completeness.

None of those are in the locked plan.

### Bottom line

Ship Fork A as written: rewrite PRODUCT to collect-all-then-batch-finalize
after close; conditional Open spots copy; comment hygiene; leave backend and
brand selection gates alone. Address nits at implement time (explicit §6.3
intro spots example; add FE copy tests; precise Closed-path wording).
