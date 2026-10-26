---
id: ops.brand-mailbox
title: Workspace mailbox is live — confirm hello@ alias and name who admins it
kind: ops
severity: P1
status: ops
surface: deploy
evidence:
  - path: backend/brand_emails.json
    note: contactEmail melissa@bringthebuzzover.com; emailFrom Buzz <hello@bringthebuzzover.com>; opsCcEmail blank
  - path: frontend/src/data/siteIdentity.ts
    note: contact.email is brandEmails.contactEmail (Contact modal, privacy, terms, data deletion)
  - path: frontend/src/data/siteIdentity.test.ts
    note: Expects melissa@bringthebuzzover.com
  - path: backend/app/services/email.py
    note: Resend From is EMAIL_FROM; every _dispatch sets reply_to to CONTACT_EMAIL; compose/late-add CC uses CONTACT_EMAIL
  - path: DEPLOYMENT.md
    note: Human inbox section records Workspace, melissa@, webmail, admin URL, and 2026-10-26 DNS; billing owner and Super Admin unnamed; hello@ alias unconfirmed
repro: |
  2026-10-26 dig @1.1.1.1 (NS felipe/melody):
  apex MX 1 smtp.google.com.
  apex TXT google-site-verification=1KWccwf2pQU0FaSvGYZDDi9q3BNMc3-S5rBL4xGNaAU
  apex TXT v=spf1 include:_spf.google.com ~all
  _dmarc TXT v=DMARC1; p=none; rua=mailto:melissa@bringthebuzzover.com
  google._domainkey TXT v=DKIM1 present (RSA public key; not copied here)
  send MX 10 feedback-smtp.us-east-1.amazonses.com.
  send TXT v=spf1 include:amazonses.com ~all
  resend._domainkey TXT present (Resend DKIM; not copied here)
  Live SPA bundle main.abbc5540.js contains melissa@bringthebuzzover.com and does not contain the former Cornell contact.
  Authoritative query to felipe.ns.cloudflare.com timed out (UDP/53); 1.1.1.1 is the probe above.
fix_when: |
  hello@bringthebuzzover.com is confirmed as a Workspace user or alias on the
  melissa@ mailbox, or DEPLOYMENT.md records an explicit decision that hello@
  must not receive (Reply-To stays melissa@).
  DEPLOYMENT.md names the Workspace billing owner and Super Admin (roles only;
  no extra personal addresses in git).
  Optional, not archive-blocking: admin sidebar Open inbox link; Gmail MCP.
  Out of scope: in-app admin inbox; Resend on send.
---

# Company mailbox — Google Workspace (contact cut over)

Split from [`ops.brand-domain-email-unset`](archive/ops.brand-domain-email-unset.md)
(2026-08-11). Sibling (done):
[`ops.resend-domain-unverified`](archive/ops.resend-domain-unverified.md)
(app autosend via Resend on `send.` — verified 2026-08-11).

Parked under `follow-ups` in [`CLUSTERS.md`](CLUSTERS.md). Do not auto-execute.
This file stays open for the remaining human checks below.

## Status (2026-10-26)

Google Workspace is live for `bringthebuzzover.com`. Public contact is
`melissa@bringthebuzzover.com` in [`backend/brand_emails.json`](../backend/brand_emails.json)
(`emailFrom` is `Buzz <hello@bringthebuzzover.com>`). The SPA reads that JSON
through `@brandEmails`. Production `www` bundle `main.abbc5540.js` (probed
2026-10-26) contains `melissa@bringthebuzzover.com` and not the former Cornell
contact.

Apex DNS on Cloudflare (via `dig @1.1.1.1`) is Google mail, not empty:

| Name | Type | 2026-10-26 |
| ---- | ---- | ---------- |
| apex | MX | `1 smtp.google.com.` |
| apex | TXT | `google-site-verification=1KWccwf2pQU0FaSvGYZDDi9q3BNMc3-S5rBL4xGNaAU` |
| apex | TXT SPF | `v=spf1 include:_spf.google.com ~all` (single SPF) |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:melissa@bringthebuzzover.com` |
| `google._domainkey` | TXT | DKIM `v=DKIM1` present |
| `send` | MX | `10 feedback-smtp.us-east-1.amazonses.com.` (Resend, untouched) |
| `send` | TXT SPF | `v=spf1 include:amazonses.com ~all` (untouched) |
| `resend._domainkey` | TXT | Resend DKIM present (untouched) |

NS is still `felipe.ns.cloudflare.com` / `melody.ns.cloudflare.com`.

### Still open (archive blockers)

| Item | Why it is still open |
| ---- | -------------------- |
| **`hello@` inbox or alias** | Transactional From is `hello@bringthebuzzover.com` (Resend on `send.`). `_dispatch` sets Reply-To to `melissa@`. DNS cannot show whether Workspace will accept mail addressed to `hello@`. Unconfirmed. |
| **Billing owner / Super Admin** | [`DEPLOYMENT.md`](../DEPLOYMENT.md) Human inbox section has provider, address, webmail, and admin console URL. It does not name who pays or who is Super Admin. Do not add personal addresses to the repo. |

Not archive-blocking: admin sidebar “Open inbox” link; Cursor Gmail MCP; tightening DMARC past `p=none`.

Receive and send-as were not re-proven from this environment (no Gmail login). The mailbox existence is taken from the team (Workspace user `melissa@`) plus the Google MX/SPF/DKIM/DMARC/verification records above. Do not treat that as a new send/receive transcript.

## Locked decisions (2026-08-11, still in force)

| Decision | Lock |
| -------- | ---- |
| **Provider** | Google Workspace |
| **Public contact** | `melissa@bringthebuzzover.com` (cut over; do not point it back at a personal address) |
| **DNS SOT** | Cloudflare only (Hostinger = registrar; never publish MX there) |
| **Webmail** | https://mail.google.com |
| **Admin** | https://admin.google.com |
| **Resend** | Stays on `send.` for app mail; **do not** enable Resend Receiving on apex |
| **CF Email Routing** | Stay off (would fight Google MX) |
| **In-app inbox** | Out of scope (PRODUCT ask) |

Display name in the Contact modal remains “Avery Example” (`siteIdentity.contact.primaryPersonName`). Changing that is a separate UX decision.

## Code / contact SOT

| Piece | Path |
| ----- | ---- |
| JSON SOT | [`backend/brand_emails.json`](../backend/brand_emails.json) |
| Alias | [`frontend/craco.config.js`](../frontend/craco.config.js) `@brandEmails` |
| Bridge | [`frontend/src/data/siteIdentity.ts`](../frontend/src/data/siteIdentity.ts) → `contact.email` |
| UI | Contact modal; Privacy; Terms; Data deletion (`mailto:` from `contact.email`) |
| Backend | [`backend/app/brand_emails.py`](../backend/app/brand_emails.py) loads `CONTACT_EMAIL` / `EMAIL_FROM` / `OPS_CC_EMAIL`. [`email.py`](../backend/app/services/email.py) uses From `EMAIL_FROM`, Reply-To `CONTACT_EMAIL` on every `_dispatch`, and CC `CONTACT_EMAIL` for admin compose and late-add. Prefill copy also prints `CONTACT_EMAIL`. |

`rg ae101` outside `gaps/archive` and `ideas/archive` (2026-10-26) hits only this gap’s history before this edit, plus tests that are **not** public-contact assertions:

| File | Why it stays |
| ---- | ------------ |
| `backend/tests/test_org_apply_prefill.py` | Parsed org-apply row; `.edu` is the applicant address |
| `frontend/src/pages/auth/OrgApplyPage.test.tsx` | Prefill draft `eduEmail` for that same applicant row |
| `backend/tests/test_email.py` | `applied_on_from_source_row_key` date parse; the address is part of the row key |
| `frontend/src/pages/admin/AdminOrgDetailPage.test.tsx` | Mock mutation result `cc` is unused. The test asserts CC is read-only and non-empty. The field is filled from `opsCcAddresses` → `contactEmail` |

College domain `cornell.edu` in `frontend/src/data/colleges.ts` and other `.edu` fixtures stay. They are not the public contact.

## Ownership

| Layer | Where | Account |
| ----- | ----- | ------- |
| Registrar | Hostinger | Melissa — Active, expires 2026-12-21; NS → Cloudflare |
| Authoritative DNS | Cloudflare zone `9103e4c774707bf5b2f17fbb9d9144cf` | Lawrence — Free; NS `felipe` / `melody` |
| Transactional send | Resend on `send.` + Railway `RESEND_API_KEY` | From `hello@…`; Reply-To `melissa@…` |
| Human inbox | Google Workspace | `melissa@bringthebuzzover.com`. Webmail https://mail.google.com. Admin https://admin.google.com. Billing owner / Super Admin not named in-repo. `hello@` alias unconfirmed. |

## Cutover risks (still)

- Enabling **CF Email Routing** publishes CF MX and fights Google MX.
- **Resend Receiving on apex** same fight.
- Publishing MX on **Hostinger DNS** is wrong (NS → Cloudflare).
- A second apex SPF (Google + Amazon SES) is unnecessary. SES SPF stays on `send.` only.
- Editing `send` or `resend._domainkey` breaks Resend.
- Orange-cloud `www` / `api` breaks Railway TLS. MX stays DNS-only.
- Do not point `contactEmail` at a personal mailbox again.

## Repo checklist

```text
[x] backend/brand_emails.json contactEmail → melissa@bringthebuzzover.com
[x] frontend/src/data/siteIdentity.test.ts expects that address
[x] Legal pages + Contact modal read siteIdentity.contact.email
[x] App mail Reply-To is CONTACT_EMAIL (melissa@)
[x] Production SPA bundle serves melissa@ (2026-10-26, main.abbc5540.js)
[x] Apex MX + SPF + google-site-verification + google._domainkey + _dmarc
[x] send. / resend._domainkey untouched
[x] DEPLOYMENT.md Human inbox section (provider, address, webmail, admin URL)
[ ] hello@ confirmed as a Workspace alias or explicitly not a mailbox
[ ] DEPLOYMENT.md names billing owner and Super Admin
[ ] Optional: AdminSidebar Open inbox → mail.google.com
[ ] Optional: user Gmail MCP as the mailbox user
```

## Coupling

- [`ops.resend-domain-unverified`](archive/ops.resend-domain-unverified.md) — archived; leave `send.` alone.
- [`ops.email-ledger`](ops.email-ledger.md) — app send honesty; does not create mailboxes.
- Denial and a few other templates say “reply to this email”. That works only if the recipient’s client honors Reply-To (`melissa@`). A client that replies to From hits `hello@`, which is the open alias question above.

## Probes (read-only)

```bash
dig @1.1.1.1 NS bringthebuzzover.com +short
dig @1.1.1.1 MX bringthebuzzover.com +short
dig @1.1.1.1 TXT bringthebuzzover.com +short
dig @1.1.1.1 TXT _dmarc.bringthebuzzover.com +short
dig @1.1.1.1 TXT google._domainkey.bringthebuzzover.com +short
dig @1.1.1.1 MX send.bringthebuzzover.com +short
dig @1.1.1.1 TXT send.bringthebuzzover.com +short
dig @1.1.1.1 TXT resend._domainkey.bringthebuzzover.com +short
```
