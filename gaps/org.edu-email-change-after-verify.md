---
id: org.edu-email-change-after-verify
title: Active orgs cannot change verified .edu email when officers swap
kind: ux_hole
severity: P2
status: open
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
  An active (or approved) org can request a new unique .edu address from the
  org portal. New address must be .edu, uniqueness-checked, and verified via
  the same email-verification flow before it becomes the login/contact identity.
  Until the new address is verified, define Locked v1 for interim behavior
  (keep old edu live vs pending-swap latch) in the gap/cluster approach —
  ask on PRODUCT fork before shipping. Old unused verification tokens
  invalidated; uniqueness / claim-TTL rules respected. PRODUCT §3.1 updated
  to allow post-verify edu change with re-verification. Tests + OpenAPI.
---

# Change verified .edu after onboarding (officer swap)

## Intent (locked by ask 2026-08-11)

Orgs must be able to **edit the verified `.edu` login identity** to a **new**
campus email (officer leaves / role swap). The **new** address must go through
**verification** before it replaces the old one as identity.

## As-built

| Path | Who | Behavior |
| ---- | --- | -------- |
| `POST /api/auth/verify-email/change` | `pending_email_verification` only | Typo fix before first verify |
| `PATCH /api/orgs/me` | active org | `eduEmail` forbidden |
| Org portal profile | active org | `.edu` read-only |

## PRODUCT note

Today PRODUCT explicitly forbids edu edit via org profile PATCH. Implementing
this gap **requires a PRODUCT §3.1 update** (hard stop — ask if wording forks
on interim access while the new address is unverified).

## Suggested Locked v1 directions (pick at implement / ask)

1. **Pending swap:** set `pending_edu_email` + send verify link; keep current
   `edu_email` until click; then swap + stamp `email_verified_at`.
2. **Re-verify gate:** move user to a short “reverify edu” status that blocks
   sensitive actions until the new address verifies (heavier).

Prefer (1) unless PRODUCT wants a hard gate.
