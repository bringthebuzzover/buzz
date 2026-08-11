---
id: ops.resend-domain-unverified
title: Resend sender domain not verified — transactional mail fails off-dev
kind: ops
severity: P1
status: fixed
closed_in: c23347d
surface: deploy
evidence:
  - path: backend/brand_emails.json
    note: emailFrom is Buzz <noreply@bringthebuzzover.com> (From identity only)
  - path: backend/app/services/email.py
    note: _dispatch POSTs to Resend off-dev; development console-logs and returns True
  - path: backend/app/config.py
    note: Off-dev fail-fast requires non-empty RESEND_API_KEY (boot); domain verify is separate
  - path: DEPLOYMENT.md
    note: Phase 1 says DKIM/SPF only (omits send. MX); Resend § says “then set key” but key already on Railway
repro: |
  Closed 2026-08-11: Resend domain Verified; Cloudflare DNS-only DKIM + send. SPF/MX;
  Railway RESEND_API_KEY rotated (send-scoped); brand invite delivered to inbox.
  dig @melody.ns.cloudflare.com TXT/MX send. + DKIM non-empty; apex MX still empty.
fix_when: |
  Resend UI shows bringthebuzzover.com Verified (DKIM TXT + SPF on send. + MX on send.
  published in Cloudflare DNS-only / grey-cloud).
  One controlled off-dev transactional send delivers (API log Email dispatched …
  resend_id= + Resend dashboard + destination inbox).
  Do not archive on RESEND_API_KEY presence alone (already set).
  DEPLOYMENT.md Phase 1 + Resend § updated: include send. MX; note key already
  provisioned; checkbox done only after Verified + inbox proof.
  Out of scope: human inbox / contactEmail / Cornell / Reply-To UX → ops.brand-mailbox.
  Out of scope: send ledger / remaining honesty → ops.email-ledger.
---

# Resend sender domain unverified

Split from [`ops.brand-domain-email-unset`](archive/ops.brand-domain-email-unset.md)
(2026-08-11). Sibling: [`ops.brand-mailbox`](../ops.brand-mailbox.md) (human send+receive).

Parked under `follow-ups` in [`CLUSTERS.md`](CLUSTERS.md) — do not auto-execute;
un-park only when named explicitly.

## Intent

Make **app transactional** mail work in prod. From stays
`Buzz <noreply@bringthebuzzover.com>` via Resend. No mailbox and no Reply-To
required for `noreply@` — it is a From identity only.

**Flows on this path** (all use `_dispatch` off-dev):

| Kind | Helper | Caller |
| ---- | ------ | ------ |
| Org verify | `send_verification_email` | `onboarding.py` |
| Brand invite | `send_brand_invite_email` | `admin.py` |
| Org approved | `send_org_approved_email` | `admin.py` |
| Org / brand deny & undeny | `send_*_denied/undenied_email` | `admin.py` |
| Drop application denied | `send_application_denied_email` | `brands.py` |
| Notify Me reminder | `send_drop_opening_reminder_email` | `jobs/notify_reminders.py` |
| Password reset | `send_password_reset_email` | `password_reset.py` |

## Why it fails today (not “missing API key”)

| Layer | Reality |
| ----- | ------- |
| Code | `_dispatch` → `https://api.resend.com/emails` with JSON `from` = `EMAIL_FROM` |
| Boot | Off-dev **requires** `RESEND_API_KEY` (`config.py` fail-fast) — api already boots |
| Railway | `RESEND_API_KEY` present on **api** + **cron-notify-reminders** (name confirmed) |
| DNS | No DKIM / `send.` SPF / `send.` MX in Cloudflare → Resend domain **not Verified** |
| Send outcome | Provider reject → `_dispatch` logs + returns `False` (never raises) |

Dev (`ENVIRONMENT=development`) never calls Resend — logs links, returns `True`.

## Independent of human mail

| | This gap | [`ops.brand-mailbox`](../ops.brand-mailbox.md) |
| --- | --- | --- |
| DNS | `resend._domainkey` + `send.` SPF/MX | Apex MX (+ provider records) |
| Blocks the other? | **No** (different names) | **No** |
| contactEmail / Cornell | Out of scope | Required |

**Do not** put Resend MX on apex. **Do not** enable Resend Receiving on apex
(steals human MX). Buzz stays Resend **send-only**.

Soft copy note (out of archive criteria here): some deny bodies say “reply to
this email” but there is no `reply_to` header — human Reply-To belongs with
mailbox cutover, not domain verify.

## Ownership (re-verified 2026-08-11)

| Layer | Where | Account |
| ----- | ----- | ------- |
| Registrar | Hostinger | Melissa — NS → Cloudflare |
| Authoritative DNS | Cloudflare zone `9103e4c774707bf5b2f17fbb9d9144cf` | Lawrence — Free; NS `felipe` / `melody` |
| Transactional send | Resend | Buzz ops — **domain not verified** |
| App | Railway (`www` / `api`) | Lawrence |

Resend Domains via Cursor MCP `plugin-resend-resend` (user/plugin; see
[`AGENTS.md`](../AGENTS.md) MCP table). Mutate Cloudflare / Resend / Railway
only with explicit OK.

## Required DNS (exact values from Resend UI)

| Type | Name | Purpose |
| ---- | ---- | ------- |
| `TXT` | `resend._domainkey…` | DKIM |
| `TXT` | `send` | SPF |
| `MX` | `send` | Return-path / bounce feedback (**not** human inbox) |
| Optional later | `_dmarc` | Policy / deliverability |

Publish in **Cloudflare** only (DNS-only / grey-cloud). Pitfalls from Resend KB:
trailing FQDN / auto-append on MX; region mismatch on `feedback-smtp.<region>…`;
adding records at Hostinger (NS already points to CF — wrong place).

**SPF coexistence:** Resend SPF stays on `send.`. Future mailbox SPF lives on
**apex** ([`ops.brand-mailbox`](../ops.brand-mailbox.md)). Do not copy Resend
`include:` onto apex “just in case.”

## Steps

1. Resend Domains UI → add `bringthebuzzover.com` → copy **exact** host/value/region.
2. Cloudflare DNS-only: DKIM TXT + `send` SPF TXT + `send` MX.
3. Wait until Resend shows **Verified** (Restart verification if needed; dig until non-empty).
4. Confirm `RESEND_API_KEY` still on Railway **api** + **cron-notify-reminders**;
   `FRONTEND_URL` = `https://www.bringthebuzzover.com` (dashboard/CLI for values).
5. One controlled prod trigger → log + inbox proof.
6. Update [`DEPLOYMENT.md`](../DEPLOYMENT.md): Phase 1 L71 + Resend § L265–272
   (add `send.` MX; key already set; checkbox only after Verified + proof).

**Preferred proof trigger:** admin brand invite to yourself, or org verify-email
resend. **Avoid** Notify Me cron (`*/5`) for first proof — retries leave
`sent_at` NULL and can flush a backlog.

## Honesty (context — not this gap’s work)

| Flow | On send `False` |
| ---- | --------------- |
| Onboarding submit | Profile kept; `email_sent: false`; token deleted |
| Verify resend / change edu | `EMAIL_SEND_FAILED` 502 |
| Brand approve | Returns `email_sent`; brand stays approved |
| Brand resend invite | `EMAIL_SEND_FAILED` 502 |
| Org approve / deny·undeny | Fire-and-forget (bool ignored) |
| Drop denial | Structured log only |
| Notify cron | Leave `sent_at` NULL → retry |
| Password reset | Always `{ok: true}`; burn token + warn |

Ledger / remaining honesty polish → [`ops.email-ledger`](../ops.email-ledger.md).

## How to test

| Where | How |
| ----- | --- |
| Local | `ENVIRONMENT=development` → links in API logs; no Resend |
| Unit | `backend/tests/test_email.py`, `test_brand_emails.py`, hardening missing-key |
| Prod | After Verified: controlled invite/verify → `Email dispatched … resend_id=` + inbox |

`EMAIL_FROM` as a Railway env var is **ignored** — From is JSON-only
(`test_brand_emails.py`).

## Probes (read-only)

```bash
dig @1.1.1.1 NS bringthebuzzover.com +short
dig @1.1.1.1 TXT resend._domainkey.bringthebuzzover.com +short
dig @1.1.1.1 TXT send.bringthebuzzover.com +short
dig @1.1.1.1 MX send.bringthebuzzover.com +short
dig @1.1.1.1 MX bringthebuzzover.com +short   # apex human MX — other gap; expect empty until mailbox
# Cloudflare MCP: list zone DNS — grey-cloud on Resend records after publish
# Railway MCP list-variables: RESEND_API_KEY name on api + cron-notify-reminders
# After send: api logs "Email dispatched" / "Email send failed"; Resend dashboard
```

## Sources

| Topic | Link / path |
| ----- | ----------- |
| Add domain | https://resend.com/docs/add-a-domain |
| Verify / `send.` MX | https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying |
| MX conflicts (apex vs send.) | https://resend.com/docs/knowledge-base/how-do-i-avoid-conflicting-with-my-mx-records |
| Deploy checklist | [`DEPLOYMENT.md`](../DEPLOYMENT.md) |
| From SOT | [`backend/brand_emails.json`](../backend/brand_emails.json) |
| Send path | [`backend/app/services/email.py`](../backend/app/services/email.py) |
| Fail-fast | [`backend/app/config.py`](../backend/app/config.py) |
