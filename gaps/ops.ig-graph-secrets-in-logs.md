---
id: ops.ig-graph-secrets-in-logs
title: Instagram access_token (and exchange secrets) can land in logs via httpx+exc_info
kind: ops
severity: P2
status: open
surface: jobs
evidence:
  - path: backend/app/services/instagram.py
    note: Graph calls put access_token in query; raise … from httpx.HTTPStatusError
  - path: backend/app/services/instagram_token.py
    note: logger.warning(..., exc_info=True) on refresh failure
  - path: backend/app/jobs/token_refresh.py
    note: exc_info=True on failure
  - path: backend/app/jobs/metric_sync.py
    note: exc_info=True on media list failure
repro: |
  Force Graph 4xx with a test token; inspect exception/log chain for
  access_token= in the URL. Client API messages stay generic (_ig_error).
fix_when: |
  httpx/Graph errors redacted before log; no access_token/client_secret in
  exc_info chains; regression test on log/exception text.
---

# IG Graph secrets in logs

Security audit 2026-08-11 (area 4b). Parent-verified raise-from-exc + exc_info
paths. Leak is to logs/APM, not SPA.
