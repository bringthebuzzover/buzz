---
id: org.signup-instagram-first
title: Org signup is Instagram-first; non-testers cannot create an account
kind: ux_hole
severity: P1
status: fixed
closed_in: 9bdbb52
surface: org
evidence:
  - path: PRODUCT.md
    note: §3.1 / §6.1 now require public org apply then Connect Instagram after review
  - path: LAUNCH.md
    note: Seeded-launch Phase A; locks and current vs target flows
  - path: backend/app/services/auth.py
    note: handle_instagram_callback INSERTs org pending_org_profile on unknown Graph id
  - path: frontend/src/components/home/HomeJoinSection.tsx
    note: Join as Student Organization → /login
  - path: backend/app/services/onboarding.py
    note: submit_org_onboarding requires require_instagram_handle
  - path: backend/app/services/admin.py
    note: approve_org sets active immediately; no pending_instagram / bind
repro: |
  Logged-out prospect: Home Join → /login → Continue with Instagram.
  Non-tester Meta Standard Access fails OAuth. No /org/apply route.
  Callback for a new Graph user always inserts a Buzz user.
fix_when: |
  Public /org/apply creates User+Organization without IG token; **§6.1.1**
  inline Instagram confirm card (Business Discovery lookup + same-page confirm;
  Business/Creator errors on card). .edu verify mints a session. Approve →
  pending_instagram + connect email. OAuth binds this user; unknown IG without
  bind does not insert. Join CTA is /org/apply. Matches LAUNCH.md Phase A and
  PRODUCT §3.1 / §6.1. Tests as listed in LAUNCH.md Phase A. Archive with
  closed_in when that phase ships.
---

# Org signup is still Instagram-first

PRODUCT (2026-08-25) and [`LAUNCH.md`](../LAUNCH.md) lock **apply-first, bind last** so seeded orgs can be added as Instagram Testers before OAuth. As-built is the old PLG path: Continue with Instagram **creates** the user.

Do not implement from this file alone — follow **LAUNCH.md Phase A** (includes `org.edu-verify-outlook-junk` on the same email pass).

## Explicit OUT

- Admin CSV import
- Meta Business Verification / App Review
- Brand drop intake (`drops.unconfigured-request-on-org-feed`)
- Ongoing magic-link login after IG bind
