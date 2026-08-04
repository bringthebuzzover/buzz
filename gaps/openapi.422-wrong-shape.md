---
id: openapi.422-wrong-shape
title: OpenAPI 422 response shape does not match runtime envelope
kind: doc_drift
severity: P2
status: deferred
surface: openapi
evidence:
  - path: openapi.json
    note: 422 schema drifts from app error envelope
repro: |
  Compare validation error JSON to OpenAPI 422 component; FE generated types disagree.
fix_when: |
  OpenAPI 422 (and generated FE types) match the runtime error envelope.
---

Confirmed in gap audit triage as deferred. Contract/typing debt only — not a runtime authz hole.
