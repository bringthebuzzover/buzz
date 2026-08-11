---
id: deploy.spa-missing-csp
title: www SPA served with no Content-Security-Policy (or page hardening headers)
kind: ops
severity: P1
status: fixed
closed_in: a32463a
surface: deploy
evidence:
  - path: frontend/package.json
    note: start:prod is serve -s build -l $PORT — no header config
  - path: frontend/public/index.html
    note: no CSP meta
  - path: DEPLOYMENT.md
    note: Says CSP belongs on static host; not implemented
  - path: backend/app/main.py
    note: API has nosniff/XFO/Referrer/HSTS — does not protect www
repro: |
  curl -sI https://www.bringthebuzzover.com/ | grep -i content-security-policy
  Expect empty. XSS on www is same-site to api → credentialed /refresh can mint Bearer.
fix_when: |
  Production www responses include a CSP (and ideally HSTS/Referrer-Policy)
  via serve config, CDN, or reverse proxy; DEPLOYMENT checklist checked.
---

# SPA missing CSP

Security audit 2026-08-11 (areas 8a/11a). Parent-verified. Amplifies any XSS into
session theft via same-site refresh.
