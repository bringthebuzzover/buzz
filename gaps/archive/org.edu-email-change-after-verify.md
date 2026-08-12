---
id: org.edu-email-change-after-verify
title: Active orgs cannot change verified .edu email when officers swap
kind: ux_hole
severity: P2
status: fixed
closed_in: bd1a3f3
surface: org
evidence:
  - path: PRODUCT.md
    note: §3.1 table — edu_email not editable via PATCH /orgs/me
  - path: backend/app/schemas/orgs.py
    note: OrgProfileUpdate intentionally omits edu_email
  - path: frontend/src/pages/org/OrgPortalProfilePage.tsx
    note: .edu shown read-only under login identity
  - path: backend/app/services/onboarding.py
    note: change_edu_email only allowed in pending_email_verification
repro: |
  Active org (status=active) with verified .edu.
  Officer leaves; new officer needs a different campus .edu.
  PATCH /api/orgs/me with eduEmail → 422 (forbidden key).
  POST /api/auth/verify-email/change → 400 INVALID_ONBOARDING_STATE
  (not awaiting verification). No portal path to rotate + re-verify.
fix_when: |
  Org users in status active or pending_approval can request a new unique
  .edu from the org portal (or equivalent rotate API). New address must be
  .edu, uniqueness-checked (live + pending claims), and verified before it
  becomes the login/contact identity.
  Locked interim (pending-swap): keep current edu_email live until verify;
  store pending_edu_email; do not demote status or block portal.
  v1 includes Resend (to pending) and Cancel (clear latch + invalidate
  unused tokens). On verify: swap edu_email, clear pending, refresh
  email_verified_at, keep status. PATCH /orgs/me still forbids eduEmail.
  PRODUCT §3.1 / §3.1.1 updated for post-verify rotate + pending-swap.
  Tests + OpenAPI.
---

# Change verified .edu after onboarding (officer swap)

## Intent (locked by ask 2026-08-11)

Orgs must be able to **edit the verified `.edu` login identity** to a **new**
campus email (officer leaves / role swap). The **new** address must go through
**verification** before it replaces the old one as identity.

## Locked v1 (PRODUCT ask resolved 2026-08-11)

| Decision | Lock |
| -------- | ---- |
| Interim while new `.edu` unverified | **Pending-swap** — keep current `edu_email` as login/contact; set `users.pending_edu_email`; send verify link to the new address; on confirm, swap + stamp `email_verified_at`; **do not** demote status or gate the portal |
| Eligible statuses | `active` **and** `pending_approval` |
| Resend | Yes — resend verification to `pending_edu_email` (reuse max-token rules) |
| Cancel | Yes — clear `pending_edu_email` + invalidate unused verification tokens |
| Profile PATCH | Still **forbids** `eduEmail`; dedicated rotate/cancel APIs under verify-email family |
| Onboarding typo-fix | Unchanged — `POST /api/auth/verify-email/change` only while `pending_email_verification` |
| Rejected alternative | Re-verify gate (status demotion / block sensitive actions) — **out of scope** |

## As-built

| Path | Who | Behavior |
| ---- | --- | -------- |
| `POST /api/auth/verify-email/change` | `pending_email_verification` only | Typo fix before first verify |
| `PATCH /api/orgs/me` | active org | `eduEmail` forbidden |
| Org portal profile | active org | `.edu` read-only |
| `users.pending_edu_email` | — | **does not exist yet** |

## PRODUCT note

Today PRODUCT §3.1.1 forbids edu edit via org profile PATCH. Implementing this
gap **requires a PRODUCT §3.1 / §3.1.1 update** describing post-verify rotate
with pending-swap (authorized as part of this gap — interim fork resolved).

## Implementation sketch (non-binding detail)

- Migration: nullable unique `users.pending_edu_email`.
- APIs: rotate + cancel; extend `verify-email` redeem for swap without status
  change; extend resend when pending is set.
- SPA: org portal Change school email + pending banner (Resend/Cancel);
  verify-page success routes active users back to portal (not pending-approval).
- Uniqueness: new address must not collide with another user’s live or pending
  edu; rotating user’s live address stays reserved until swap.
