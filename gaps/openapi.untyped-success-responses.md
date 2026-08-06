---
id: openapi.untyped-success-responses
title: Most routes expose untyped APIResponse; FE re-handwrites wire types
kind: doc_drift
severity: P2
status: deferred
surface: openapi
evidence:
  - path: backend/app/routes/drops.py
    note: response_model=APIResponse; DropDetailResponse never enters OpenAPI
  - path: frontend/src/api/hooks/useDropHooks.ts
    note: DropFeedItem / DropDetail hand-typed beside generated schema.ts
  - path: frontend/src/api/generated/schema.ts
    note: gen:api output barely imported by app hooks
  - path: gaps/openapi.422-wrong-shape.md
    note: sibling parked gap for 422 envelope only — this gap is success payloads
repro: |
  Dump OpenAPI: success `data` is opaque. FE hooks declare parallel TypeScript
  shapes; adding a field (e.g. org DropDetail finalizedAt) requires hand sync,
  not schema.ts alone.
fix_when: |
  High-traffic read/mutation routes use typed DataResponse[T] (or equivalent)
  so dump_openapi + gen:api emit real success schemas; at least one pilot
  surface (drops feed/detail or BrandProfile pattern) consumes generated types
  in hooks. CI still fails on openapi/schema drift. No runtime envelope change.
---

## Context (SOT/DRY audit)

Contract/typing debt — SPA already works via hand-written hooks. Sibling
`openapi.422-wrong-shape` covers error 422 docs only; do **not** merge the two
without an explicit Locked v1 that does both.

### Suggested Locked v1 (draft — refine before un-parking)

1. Introduce a generic success wrapper (e.g. `DataResponse[T]` with `data: T`)
   consistent with `api_response` / camelCase serializers.
2. Pilot 1–2 routers (prefer org drops feed + detail, where Pydantic models
   already exist) with `response_model=DataResponse[DropDetailResponse]`.
3. Regen `openapi.json` + `schema.ts`; point the matching FE hooks at generated
   types (BrandProfile-style).
4. Non-goals this gap: full 65-route sweep in one PR; changing `apiFetch`
   envelope; fixing 422 (separate gap).

### Why parked

Large surface area; easy to thrash OpenAPI without user benefit until a pilot
is locked. Un-park only when named explicitly with a scoped Locked v1.
