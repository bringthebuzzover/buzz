---
id: org.edu-verify-outlook-junk
title: Org .edu verification mail is junk-shaped and campus Outlook files it as junk
kind: ux_hole
severity: P1
status: open
surface: org
evidence:
  - path: backend/app/services/email.py
    note: _dispatch sends text only (no html); From is EMAIL_FROM; no reply_to; verify body is three lines + raw token URL
  - path: backend/brand_emails.json
    note: emailFrom is Buzz <noreply@bringthebuzzover.com>
  - path: backend/app/services/onboarding.py
    note: resend_verification_email leaves org_name="" on pending_email_verification; only rotate loads Organization.org_name
  - path: backend/app/services/email.py
    note: _verification_body falls back to "your organization"; one template for signup and officer-swap
  - path: frontend/src/pages/onboarding/VerifyEmailPage.tsx
    note: waiting copy never mentions Junk; campus Outlook is the primary .edu inbox
  - path: DEPLOYMENT.md
    note: Resend DKIM/SPF on send. done 2026-08-11; DMARC called out as later
repro: |
  2026-08-14 20:55Z Resend id b9e0dc2a-f823-4144-8a25-b5b38753ae5b
  (subject "Verify your Buzz organization email", to mc3237@cornell.edu)
  status delivered. Cornell Outlook junked it: "This message was identified
  as junk", "You don't often get email from noreply@bringthebuzzover.com",
  SafeLinks wrap. Body started "Click the link below to verify your email
  for your organization on Buzz." + raw token URL.
  dig @1.1.1.1 TXT _dmarc.bringthebuzzover.com → empty.
  Same template resent 2026-08-25 15:31Z (still delivered, still text-only).
fix_when: |
  Signup verify mail uses locked copy (created-account + org name + 24h +
  ignore-if-not-you). Rotate/officer-swap uses the locked rotate copy (not
  "you just created"). HTML + matching text; coral Verify email button;
  raw URL as paste fallback. From is Buzz <hello@bringthebuzzover.com>;
  Reply-To is contactEmail. Signup resend includes org name. Waiting screen
  tells the user to check Junk. Tests cover both bodies + html+text dispatch
  + From/Reply-To. Inbox proof to a Cornell (or other campus Outlook)
  mailbox is nice-to-have, not archive-blocking if code+tests match Locked.
  DMARC p=none is optional ops (Cloudflare) — do not mutate DNS unless named.
---

# Org .edu verify lands in campus Outlook junk

Resend **delivered** the 2026-08-14 Cornell verification send. Outlook then
filed it as junk. `ops.resend-domain-unverified` is archived (DKIM + `send.`
SPF/MX). Delivered ≠ inbox.

The mail looks like phishing: `noreply@`, three-line plain text, generic
“your organization”, CTA is a long `/onboarding/verify-email?token=` URL.
Outlook SafeLinks wraps it. The waiting screen does not mention Junk.

Signup **resend** never loads `org.org_name` (only the rotate branch does),
so the fallback “your organization” is the live path after Resend.

## Locked v1

Copy locked 2026-08-25 (chat). Two variants — do not use signup copy on
officer-swap.

**Signup** (first verify + resend while `pending_email_verification`)

Subject: `Confirm your Buzz account`

```
You just created a Buzz account for {org}.

Confirm this school email so we can review {org} and open the org portal.

Verify email:
{url}

This link expires in 24 hours.

If you didn't create this account, ignore this email.
```

**Rotate** (`pending_edu_email` latch)

Subject: `Confirm the new school email for {org}`

```
Someone requested a new school email for {org} on Buzz.

Confirm this address to finish the change.

Verify email:
{url}

This link expires in 24 hours.

If you didn't request this, ignore this email.
```

HTML twin: same words, cream/ink, coral **Verify email** button, then
“Or paste this link:” + the URL. No open/click tracking.

**From / Reply-To** (all `_dispatch` mail, not verify-only): flip
`brand_emails.json` `emailFrom` to `Buzz <hello@bringthebuzzover.com>`;
pass `reply_to` = `CONTACT_EMAIL` (Cornell until
[`ops.brand-mailbox`](ops.brand-mailbox.md) cutover).

**Waiting screen:** “We sent a verification link to your school email.
Campus inboxes often put first-time Buzz mail in Junk.”

Pass `kind` (signup vs rotate) into `send_verification_email`. Always pass
`org_name` on signup mint **and** signup resend.

## Explicit OUT

- Restyling invite / approve / deny / Notify Me / reset (same HTML shell
  later is fine; not this gap).
- React Email, tracking pixels, List-Unsubscribe (transactional).
- DMARC / Cloudflare DNS unless the user names it (recommend `_dmarc`
  `p=none` as a follow-up; Microsoft weights it for new domains).
- Send ledger / Resend webhooks → [`ops.email-ledger`](ops.email-ledger.md).

## Coupling

- [`ops.resend-domain-unverified`](archive/ops.resend-domain-unverified.md)
  — archived; this is content + From + Outlook, not domain verify.
- [`ops.brand-mailbox`](ops.brand-mailbox.md) — Reply-To stays Cornell
  until that cutover; do not flip `contactEmail` here.
- [`org.edu-email-change-after-verify`](archive/org.edu-email-change-after-verify.md)
  — rotate path must keep rotate copy.

## Probes (read-only)

```bash
dig @1.1.1.1 TXT _dmarc.bringthebuzzover.com +short
dig @1.1.1.1 TXT send.bringthebuzzover.com +short
```

Resend MCP: `list-emails` / `get-email` for subject
`Verify your Buzz organization email` — expect `text` only, no `html`,
From `noreply@`.
