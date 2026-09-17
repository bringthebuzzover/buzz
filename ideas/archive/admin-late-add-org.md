---
id: admin-late-add-org
title: Admin override — add orgs to a published, not-finished drop
status: shipped
updated: 2026-09-17
---

# Admin late-add org to a drop

**Shipped** on `main` (`1e2cb36`). Behavior SOT is [`PRODUCT.md`](../../PRODUCT.md)
**§7.1**. This file is provenance. Do not implement from here.

Brainstorm (2026-09-13). Related TBD already in
[`PRODUCT.md`](../../PRODUCT.md) §12: admin tooling for reopen, exception
handling, and **Buzz override paths**.

## Desired motion

Admin can add more orgs onto a **published, unhidden, not-finished** drop at
any time (Open, selection, awaiting products, Active). Override, not a new
public apply round. **Refuse** finished, hidden, and unpublished drafts. May
add an org that **never applied** — UI must warn in that case.

Do **not** reuse admin **reopen apply**. Reopen opens the window for everyone
and is already **409** once the drop is live/finished **and** finalized
(`backend/app/services/admin.py` `reopen_drop`).

## How it fits today

There is no `OrgDrop` / assignment table. An org is “on” a drop only as a
`drop_applications` row (`decision` = `applied` | `accepted` | `denied`).
My Campaigns / brand KPI seats / post linking all key off **`accepted`**.

So late-add = **write an `accepted` application** (insert, or flip a pending
`applied` / previously `denied` row). Schema already has the seat.

## Constraints that block it today (must not reuse)

| Gate | Where | Why it blocks |
| ---- | ----- | ------------- |
| Finalize latch | `drop_apply_eligibility` | Apply rejected after `applicant_selection_finalized_at` |
| Window / reopen | same | After close, only `manual_reopen` |
| Capacity | same | `accepted_count >= capacity_total` |
| Finished / hidden | `_require_browsable_drop` | Finished drops are not apply-eligible |
| Must already be `applied` | `finalize_applicants` `ORG_NOT_APPLIED` | Brand cannot accept a non-applicant |
| One-shot finalize | `ALREADY_FINALIZED` | No second brand round without reopen |
| Reopen on live/finished | `reopen_drop` 409 | Intentional; do not undo this |
| Post link when finished | `posts.py` `_reject_if_drop_finished` | Late org on a finished drop cannot attach UGC |

## DB

**No new table required** for the seat. Optional later:

- Audit: `added_by_admin_at` / `source=admin_override` on `drop_applications`
  (nice; not required if admin action log / email is enough)
- Units: existing `allocated_units` if the drop has `total_product_units`
- Per-org tracking: **separate** open gap
  [`gaps/archive/drops.tracking-not-per-org.md`](../../gaps/archive/drops.tracking-not-per-org.md)
  — late-add makes that hole louder (another org sharing one drop-level TN)

Partial unique `uq_drop_application_active` already allows a new non-denied
row after a prior `denied`.

## Locked (2026-09-13)

| Fork | Lock |
| ---- | ---- |
| Capacity | **Overbook allowed.** Do not bump `capacity_total`. `accepted_count` may exceed spots. |
| Notify | Two **checkboxes** on the confirm dialog: email org, email brand. Independent. |
| Hidden drops | **Refuse.** |
| Unpublished drafts | **Refuse.** |
| Finished | **Refuse.** No late-add once `drop_finished`. Avoids the UGC freeze. |
| When | **Anytime** on an allowed drop (Open / selection / awaiting / Active), including before brand finalize. |
| Who | **Any org row** in the DB (pending, no IG, platform-denied included). Warn when they never applied, and when they cannot use the portal. |
| Email checkboxes | Default **off**. Independent org + brand. |
| Email fail | Add **still commits**. Surface send failure; do not roll back the seat. |
| Units | Field on the dialog; default **0** when the drop is budgeted. Over-budget allowed. |
| Late-add mail CC | **Yes** — `_ops_cc()` (Melissa + Lawrence). |
| Undo / un-accept | Out of scope. |

## Known interactions (not new forks unless promoted)

See chat 2026-09-13. Admin accepts count toward `accepted_count` / brand
finalize remaining capacity / org-feed fullness. Adding during Open can
change “Up to N spots” copy, and filling capacity **closes Apply** on the
feed before the brand has finalized. Admin add does **not** set
`applicant_selection_finalized_at`; tracker still cannot skip past
selection until the brand (or View as) finalizes.

## Lean shape (if promoted)

`POST /api/admin/drops/{id}/add-org` with `org_id`, optional units, and
`email_org` / `email_brand` booleans. Confirm dialog: extra warning when
no prior application (and when the org is not portal-ready). Finished /
hidden / draft → refuse. Already accepted → 409. Do not clear
`applicant_selection_finalized_at`. Do not set `manual_reopen`. Do not
change tracker stage. Leave brand finalize and org apply gates intact.
