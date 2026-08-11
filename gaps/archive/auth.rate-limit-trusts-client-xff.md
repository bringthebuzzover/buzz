---
id: auth.rate-limit-trusts-client-xff
title: Per-IP rate limits key off first X-Forwarded-For hop (client-spoofable)
kind: authz
severity: P1
status: fixed
closed_in: a32463a
surface: auth
evidence:
  - path: backend/app/security/rate_limit.py
    note: _client_ip prefers first XFF hop; never reads X-Real-IP
  - path: DEPLOYMENT.md
    note: Documents single-replica memory limits only — not XFF trust
repro: |
  Against api.bringthebuzzover.com, rotate X-Forwarded-For on each
  POST /api/brands/apply (or other IP-only limited route).
  Confirm 429 never trips while spoofing unique XFF values.
  (Live edge overwrite of client XFF still to confirm; Railway docs cite X-Real-IP.)
fix_when: |
  Client IP from Railway-trusted header (e.g. X-Real-IP) or rightmost/trusted
  hop; adversarial XFF cannot mint a new bucket; DEPLOYMENT documents the trust
  model; tests cover spoof bypass.
---

# Rate limit trusts client XFF

Security audit 2026-08-11 (area 6a). Parent-verified trust model; live edge
overwrite not probed. Login/forgot retain per-account caps (partial mitigation).
