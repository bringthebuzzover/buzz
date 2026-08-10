---
id: openapi.untyped-success-responses
title: Most routes expose untyped APIResponse; FE re-handwrites wire types
kind: doc_drift
severity: P2
status: fixed
surface: openapi
closed_in: pending
evidence:
  - path: backend/app/response.py
    note: DataResponse[T] envelope used across routers
  - path: backend/app/schemas/acks.py
    note: OkResponse + shared mutation ack CamelModels
  - path: frontend/src/api/hooks/useBrandHooks.ts
    note: Payload aliases from components["schemas"]
  - path: gaps/archive/openapi.422-wrong-shape.md
    note: Sibling 422 envelope gap archived separately
repro: |
  Dump OpenAPI: success `data` is opaque. FE hooks declare parallel TypeScript
  shapes; adding a field requires hand sync, not schema.ts alone.
fix_when: |
  All former APIResponse success routes use DataResponse[T] with real Pydantic
  payloads; FE hooks alias generated schemas; dump_openapi + gen:api stay in CI.
  Auth Token/User/Refresh remain snake_case BaseModels. No runtime envelope change.
---

## Fixed (2026-08-10)

Full success-type migration:

- Every former `response_model=APIResponse` route → `DataResponse[T]`
- Shared acks in `schemas/acks.py` (`OkResponse`, invite/status/tracker acks, etc.)
- Auth `TokenResponse` / `UserResponse` / `RefreshResponse` stay snake_case `BaseModel`
- FE hooks (`useBrandHooks`, `useOrgHooks`, `useAdminHooks`, `useDropHooks`,
  `useOnboardingHooks`) + `api/auth.ts` alias generated payload schemas
- Admin FE honesty: `AdminOrgDetail` / `AdminDropDetail` no longer inherit
  list-only phantom fields via intersection
- Required epoch serializers tightened (`to_epoch_ms_required`) so OpenAPI
  does not widen required times to `number | null`
