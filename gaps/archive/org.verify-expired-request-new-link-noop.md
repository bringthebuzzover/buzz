---
id: org.verify-expired-request-new-link-noop
title: "Request a new link" after expired .edu verify does not send mail
kind: ux_hole
severity: P1
status: fixed
surface: org
evidence:
  - path: frontend/src/pages/onboarding/VerifyEmailPage.tsx
    note: Error CTA only navigate()s to /onboarding/verify-email with no resend POST
  - path: backend/app/services/onboarding.py
    note: Expired redeem raises VERIFICATION_TOKEN_EXPIRED; no resend-from-token path
repro: |
  Open /onboarding/verify-email?token= for an expired unused token, click Verify
  email, then Request a new link. No new EmailVerificationToken is minted and
  no verification email is sent. In a fresh mail-client tab, the wait page has
  no sessionStorage .edu so Resend is disabled.
fix_when: |
  Request a new link on an expired (still unused) token POSTs a sessionless
  resend-from-token API that mints and sends a new link to the address on the
  token row. Invalid/used tokens do not send. Rotate pending-swap expired
  tokens resend to pending_edu_email. Tests cover expire→resend.
---

Fixed: `POST /api/auth/verify-email/resend-from-token` plus the error CTA now
calls it. `closed_in` pending commit.
