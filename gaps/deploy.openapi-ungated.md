---
id: deploy.openapi-ungated
title: /api/docs and /api/openapi.json public in production
kind: ops
severity: P2
status: open
surface: openapi
evidence:
  - path: backend/app/main.py
    note: docs_url and openapi_url unconditional
repro: |
  curl -sS -o /dev/null -w "%{http_code}" https://api.bringthebuzzover.com/api/docs
  curl -sS -o /dev/null -w "%{http_code}" https://api.bringthebuzzover.com/api/openapi.json
  Both return 200 (verified 2026-08-11).
fix_when: |
  Off-dev docs_url/openapi_url disabled or auth-gated; CI/smoke asserts 404/401
  in production-like ENVIRONMENT.
---

# OpenAPI ungated

Security audit 2026-08-11 (area 8b). Parent-verified live 200s. Recon aid, not
direct ATO.
