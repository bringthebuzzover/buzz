---
id: org.edu-rotate-hidden-pending-instagram
title: .edu rotate has no UI after Instagram switch demotes the org
kind: ux_hole
severity: P2
status: open
surface: org
evidence:
  - path: PRODUCT.md
    note: §3.1 lists pending_instagram as eligible to rotate .edu; §3.1.4 says rotate while still active (connect mail goes to current edu_email)
  - path: backend/app/services/onboarding.py
    note: _ROTATE_ELIGIBLE_STATUSES includes pending_instagram; POST /verify-email/rotate works if they still have a session
  - path: frontend/src/pages/onboarding/ConnectInstagramPage.tsx
    note: Connect-after-Approve/switch has no EduEmailRotatePanel
  - path: frontend/src/components/routing/RequireStatus.tsx
    note: Non-active orgs cannot reach /org/profile (the only other rotate surface is pending-approval)
  - path: backend/app/services/email.py
    note: IG switch connect mail is sent to live edu_email, not a pending new officer address
repro: |
  Active org requests an Instagram account switch and also needs a new campus
  .edu (officer swap). If ops approves the IG switch first, Buzz demotes to
  pending_instagram, bumps token_version, and emails the connect link to the
  current edu_email. The new officer has no portal, no profile rotate panel,
  and no verification mail at their inbox. Resend production (2026-09-14)
  has signup verify + IG connect mails, and no "Confirm the new school email"
  rotate sends in the recent ledger.
fix_when: |
  A pending_instagram org (or the public connect page after redeem) can start
  or finish a pending-swap .edu rotate, or PRODUCT drops pending_instagram
  from the rotate-eligible list and ops copy is explicit that .edu must be
  rotated while still active. Connect mail recipient stays the live .edu
  until verify (current PRODUCT). Do not invent a second identity email.
---

# .edu rotate disappears after IG switch

Officer swap is two independent actions: Instagram request (no email on
submit) and **Change school email** (verification goes to the **new** `.edu`).

The rotate API is not dead — `POST /api/auth/verify-email/rotate` and tests
are in place (`gaps/archive/org.edu-email-change-after-verify.md`). The hole
is sequencing: after an **account-switch approve**, the org is kicked out of
the portal. Connect Instagram has no rotate control even though PRODUCT §3.1
names `pending_instagram` as eligible.

2026-09-14 ENT incident: IG switch connect delivered to the live school
address on file; no rotate-subject mail in Resend. New officer looking in a
different inbox will correctly report “verification never arrived.”
