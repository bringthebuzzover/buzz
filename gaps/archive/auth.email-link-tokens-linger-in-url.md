---
id: auth.email-link-tokens-linger-in-url
title: Invite/reset/verify secrets stay in SPA query string and history
kind: authz
severity: P1
status: fixed
closed_in: fc254e4
surface: spa
evidence:
  - path: backend/app/services/email.py
    note: Links are FRONTEND_URL/...?token={raw}
  - path: frontend/src/pages/auth/BrandSetupPage.tsx
    note: reads ?token=; no history.replaceState strip
  - path: frontend/src/pages/auth/ResetPasswordPage.tsx
    note: same
  - path: frontend/src/pages/onboarding/VerifyEmailPage.tsx
    note: same; auto-redeems on load
  - path: frontend/public/index.html
    note: no Referrer-Policy meta; SPA host has no CSP
repro: |
  Open invite/reset/verify link; after success check history / address bar.
  Token still present on prior history entry or current URL until navigate.
fix_when: |
  After reading token, replaceState/strip query; prefer fragment or one-time
  exchange where feasible; Referrer-Policy on SPA host for token pages.
---

# Email link tokens linger in URL

Security audit 2026-08-11 (areas 5b/11b). Parent-verified. Leak via history,
screenshots, shared tabs, www access logs.
