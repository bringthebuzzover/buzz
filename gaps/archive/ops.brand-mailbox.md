---
id: ops.brand-mailbox
title: hello@ is a Workspace alias on melissa@
kind: ops
severity: P1
status: fixed
surface: deploy
evidence:
  - path: backend/brand_emails.json
    note: contactEmail melissa@bringthebuzzover.com; emailFrom Buzz <hello@bringthebuzzover.com>; opsCcEmail blank
  - path: frontend/src/data/siteIdentity.ts
    note: contact.email is brandEmails.contactEmail (Contact modal, privacy, terms, data deletion)
  - path: backend/app/services/email.py
    note: Resend From is EMAIL_FROM; every _dispatch sets reply_to to CONTACT_EMAIL
  - path: DEPLOYMENT.md
    note: Human inbox records sole user melissa@ (Super Admin) and hello@ as an alias. Inbox proof 2026-10-26. Billing profile not opened.
repro: |
  Closed 2026-10-26. Melissa added hello@ as an alias on the sole Workspace
  user melissa@. A message to hello@ arrived in that Gmail inbox (Lawrence).
  Resend send. records were not changed.
  DNS the same day (dig @1.1.1.1): apex MX 1 smtp.google.com.; SPF
  v=spf1 include:_spf.google.com ~all; DMARC p=none rua melissa@;
  google._domainkey and resend._domainkey present; send MX/SPF are Resend.
fix_when: |
  hello@ is an alias on the melissa@ Workspace user, or DEPLOYMENT.md records
  an explicit decision that hello@ must not receive (Reply-To stays melissa@).
  Met by the alias plus inbox proof. Billing profile was not opened (sole
  user, so no second admin). Optional and not archive-blocking: admin sidebar
  Open inbox link; Gmail MCP.
  Out of scope: in-app admin inbox; Resend on send.
---

# Company mailbox — Google Workspace Business Starter

Closed 2026-10-26. Split from [`ops.brand-domain-email-unset`](ops.brand-domain-email-unset.md). Sibling: [`ops.resend-domain-unverified`](ops.resend-domain-unverified.md) (Resend on `send.`, verified 2026-08-11).

`hello@bringthebuzzover.com` is an alias on the sole Workspace user `melissa@bringthebuzzover.com` (Super Admin). Mail to `hello@` lands in that Gmail inbox. App mail still sends From `Buzz <hello@bringthebuzzover.com>` via Resend and sets Reply-To to `melissa@`. A client that replies to From reaches the same inbox.

Send-as (Gmail sending as `hello@`) was not set up. The alias only covers inbound. The Google billing profile was not opened.

## Locked decisions (still in force)

| Decision             | Lock                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| **Provider**         | Google Workspace Business Starter                                     |
| **Public contact**   | `melissa@bringthebuzzover.com`                                        |
| **`hello@`**         | Alias on that user, not a second seat                                 |
| **DNS SOT**          | Cloudflare only (Hostinger = registrar; never publish MX there)       |
| **Webmail**          | https://mail.google.com                                               |
| **Admin**            | https://admin.google.com                                              |
| **Resend**           | Stays on `send.` for app mail; do not enable Resend Receiving on apex |
| **CF Email Routing** | Stay off (would fight Google MX)                                      |
| **In-app inbox**     | Out of scope (PRODUCT ask)                                            |

Display name in the Contact modal remains “Avery Example” (`siteIdentity.contact.primaryPersonName`).

## Ownership

| Layer              | Where                                              | Account                                                                         |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| Registrar          | Hostinger                                          | Melissa — Active, expires 2026-12-21; NS → Cloudflare                           |
| Authoritative DNS  | Cloudflare zone `9103e4c774707bf5b2f17fbb9d9144cf` | Lawrence — Free; NS `felipe` / `melody`                                         |
| Transactional send | Resend on `send.` + Railway `RESEND_API_KEY`       | From `hello@…`; Reply-To `melissa@…`                                            |
| Human inbox        | Google Workspace Business Starter                  | Sole user `melissa@` (Super Admin). Alias `hello@`. Billing profile not opened. |

## Cutover risks

- Enabling **CF Email Routing** publishes CF MX and fights Google MX.
- **Resend Receiving on apex** same fight.
- Publishing MX on **Hostinger DNS** is wrong (NS → Cloudflare).
- A second apex SPF (Google + Amazon SES) is unnecessary. SES SPF stays on `send.` only.
- Editing `send` or `resend._domainkey` breaks Resend.
- Do not point `contactEmail` at a personal mailbox again.
- Do not set DMARC `aspf=s`. Resend’s MAIL FROM stays on `send.`, so strict SPF alignment would fail app mail.

Not done, and not a reason to reopen: admin sidebar “Open inbox” link; Cursor Gmail MCP; tightening DMARC past `p=none`; opening Billing.
