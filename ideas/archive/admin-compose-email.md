---
id: admin-compose-email
title: Admin compose-and-send email from org/brand profile
status: shipped
updated: 2026-09-17
---

# Admin compose email from a profile

**Shipped** on `main` (`03323a3`). Behavior SOT is [`PRODUCT.md`](../../PRODUCT.md)
**§10**. This file is provenance. Do not implement from here.

Brainstorm (2026-09-13). Related ops: [`gaps/ops.brand-mailbox.md`](../../gaps/ops.brand-mailbox.md)
(company inbox cutover; **in-app inbox still out of scope**),
[`gaps/ops.email-ledger.md`](../../gaps/ops.email-ledger.md) (no send history).

## Desired motion

On admin org or brand profile, a **Write email** button opens a popup.
Admin writes subject + body, sends via Resend. Default copy mentions that
**replies go to…** (Melissa / contact). Automatically **CC the usual**
(Melissa + Lawrence).

This is **compose from a known To**, not an in-app mailbox. That distinction
matters: `ops.brand-mailbox` already parks in-app inbox as PRODUCT + OAuth
weeks. A one-shot send does not require that.

## How it fits today

All mail already goes through `backend/app/services/email.py` `_dispatch`
(Resend). From is always `Buzz <hello@bringthebuzzover.com>`. Reply-To is
always `CONTACT_EMAIL` (`mc3237@cornell.edu` until mailbox cutover). CC is
already supported; `_ops_cc()` = contact + `OPS_CC_EMAIL`
(`lg626@cornell.edu`), used today only on UPDATE prefill mail.

Admin profiles already exist:

- `/admin/orgs/:userId` — To = `users.edu_email`
- `/admin/brands/:brandId` — To = `brands.company_email`

Existing “send email” actions are **fixed templates** (approve, deny, resend
connect/invite). Marketing Contact is `mailto:`, not Resend.

## Does it make sense?

**Yes as a thin ops tool.** Same plumbing as every other send. Prefill To
from the profile, default footer (“Reply to this email — it goes to
{contact}”), always `_ops_cc()`, honesty on provider accept/fail.

**Caveats (not blockers, but real):**

1. Reply-To is still Melissa’s Cornell address until Workspace cutover.
   Recipients who hit Reply will land in that inbox; CC Lawrence already
   mirrors the “usual” ops thread. After cutover, only `brand_emails.json`
   has to change.
2. No send ledger today — admin cannot later prove what was sent unless
   this ships a row or we accept Gmail/Resend as the record.
3. Sends are best-effort; compose should surface `email_sent` / 502 like
   brand invite resend, not silent success.
4. Do **not** enable Resend Receiving or build threads. Replies stay in
   Gmail (Cornell now, Workspace later).

## DB

Not required for v1. Optional: one `email_sends` row (kind=`admin_compose`)
— same work as `ops.email-ledger`.

## Locked (2026-09-13)

| Fork | Lock |
| ---- | ---- |
| Reply-To | Ship now with Cornell `CONTACT_EMAIL`. Change later = `brand_emails.json` `contactEmail` only (already the SOT for Reply-To + public mailto). |
| Body | Existing cream/coral HTML wrapper around the admin-typed body. |
| To | Locked to profile email (org `.edu` / brand `company_email`). Not editable. |
| Attachments | **None.** |
| Ledger | **Skip v1.** Gmail / Resend is the record. |
| CC in UI | **Visible** (read-only), not hidden. |
| Empty subject/body | **Block send.** |
| Resend reject | **Fail the request** (like brand invite resend). |

CC the usual (`_ops_cc()`) on every send. Replies stay in Gmail. Default
subject/body copy still to draft at promote (footer must mention Reply-To).
Escape admin-typed body before wrapping in HTML.
