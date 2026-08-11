---
id: spa.unvalidated-post-href
title: Brand post links bind href={p.url} with no http(s) scheme allowlist
kind: authz
severity: P2
status: fixed
closed_in: a32463a
surface: spa
evidence:
  - path: frontend/src/components/brand/ApiDropOrgTable.tsx
    note: href={p.url} and img src from API media fields
  - path: backend/app/jobs/metric_sync.py
    note: permalink/media_url written from Graph without scheme checks
repro: |
  If social_posts.url were javascript:… (DB/Graph poison), brand click executes
  in www origin. No frontend tests for scheme rejection.
fix_when: |
  Only http/https URLs rendered as href/src (client + preferably server);
  component/E2E test with hostile schemes.
---

# Unvalidated post href

Security audit 2026-08-11 (area 11a). Parent-verified sink. Severity conditional
on URL poison path (Graph/DB); defense-in-depth still warranted.
