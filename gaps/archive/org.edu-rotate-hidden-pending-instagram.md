---
id: org.edu-rotate-hidden-pending-instagram
title: .edu rotate has no UI after Instagram switch demotes the org
kind: ux_hole
severity: P2
status: fixed
surface: org
evidence:
  - path: PRODUCT.md
    note: §3.1.4 request confirm names the live .edu Connect inbox; rotate while still active if the officer is changing
  - path: frontend/src/components/org/IgChangeRequestPanel.tsx
    note: Submit request opens Cancel/Confirm that shows connectEmail (live school email)
  - path: frontend/src/pages/onboarding/ConnectInstagramPage.tsx
    note: Intentionally no EduEmailRotatePanel — locked 2026-09-17
  - path: backend/app/services/email.py
    note: IG switch connect mail is still sent to live edu_email, not pending_edu_email
repro: |
  Active org requests an Instagram account switch without rotating .edu.
  Confirm dialog shows the live school email; after Confirm, admin switch
  Connect mail still goes there.
fix_when: |
  Request modal confirms the live .edu Connect inbox (Cancel or Confirm).
  PRODUCT §3.1.4 names that honesty. No Connect-page rotate panel.
  Connect mail recipient stays the live .edu until rotate verify.
---

# .edu rotate after IG switch — locked honesty at request

**Shipped 2026-09-17.** Locked approach is **not** a rotate panel on Connect
Instagram. Before an org submits an Instagram identity-change request, Buzz
shows the **live school email on file** and requires Cancel or Confirm.
Connect mail on a later **account-switch** approve still goes to that live
`.edu`. If a new officer should receive it, they Change school email while
still `active`, then request the IG change.

Connect Instagram has no rotate UI by design. `pending_instagram` remains
API-eligible for pending-swap if a rotate was already started.

2026-09-14 ENT incident: switch approved with no prior rotate; Connect went
to the live school address. The confirm dialog makes that inbox obvious at
request time.
