---
id: config.environment-dev-bypass
title: Fail-fast skipped when ENVIRONMENT is development (default); not allowlisted
kind: ops
severity: P2
status: open
surface: deploy
evidence:
  - path: backend/app/config.py
    note: default ENVIRONMENT=development; _forbid_default_secrets_outside_dev early-returns
  - path: DEPLOYMENT.md
    note: Requires staging/production; code accepts any non-development string
repro: |
  Boot API with ENVIRONMENT unset or development on a public host → committed
  SECRET_KEY/Fernet defaults + Secure=false + dev-login enabled.
  Live api has ENVIRONMENT set (MCP name present 2026-08-11); residual is
  misconfig footgun + no Literal allowlist.
fix_when: |
  Off-dev require ENVIRONMENT in {staging, production} (or equivalent);
  document that missing env fails closed; optional entropy floor for SECRET_KEY;
  test Fernet-default rejection + staging matrix.
---

# ENVIRONMENT development bypass

Security audit 2026-08-11 (areas 7a/7b). Parent-verified. Live prod appears
configured; gap tracks hardening so a mis-set env cannot silently ship forgeable
JWTs.
