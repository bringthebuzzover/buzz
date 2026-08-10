---
closed_in: pending-commit
id: openapi.422-wrong-shape
title: OpenAPI 422 response shape does not match runtime envelope
kind: doc_drift
severity: P2
status: fixed
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

## Plan verification

**Verdict: NO_PLAN**

No `## Locked v1 fix` exists (gap body is triage-only; `gaps/CLUSTERS.md` parks the id under deferred with no locked approach). What exists is `fix_when` plus an implied “make OpenAPI match runtime” goal. That acceptance criterion is **directionally correct** and **technically feasible**, but it is not an executable plan.

### Evidence (bug is real; runtime already fixed)

| Layer | Shape |
|---|---|
| **Runtime** (`backend/app/main.py` `validation_exception_handler`) | `{ data: null, meta: null, error: { code: "VALIDATION_ERROR", message, details: { errors: <pydantic exc.errors()> } } }` via `api_error_response` |
| **OpenAPI 422** (`openapi.json` ×65 ops) | `$ref: #/components/schemas/HTTPValidationError` → `{ detail?: ValidationError[] }` (FastAPI default) |
| **Already-correct envelope schemas** | `APIResponse` + `ErrorDetail` exist in the same `openapi.json` and match runtime |
| **FE wire types** (`frontend/src/api/types.ts` + `client.ts` / `errors.ts`) | Hand-written `ApiEnvelope` / `ApiError` branch on `error.code` — match runtime, **not** generated 422 |
| **FE generated usage** | `HTTPValidationError` / `ValidationError` appear only in `frontend/src/api/generated/schema.ts`; **zero** app imports |

Tests already lock the runtime contract (e.g. `backend/tests/test_orgs_routes.py::test_patch_me_validation_error` asserts `error.code == VALIDATION_ERROR` and `details.errors` is a list). The gap is **doc/codegen drift only** — consistent with `kind: doc_drift`, `status: deferred`, parked.

### What `fix_when` gets right

- Target is OpenAPI + regenerated FE types matching the **envelope**, not reverting the exception handler to FastAPI’s `{detail: [...]}`.
- Runtime handler must stay as-is; changing wire format would break `apiFetch` / every `error.code` branch.

### Why this is still NO_PLAN (not PASS)

`fix_when` states the done condition but omits: where to change generation, which schema to use for 422, regen/CI steps, regression guard, and non-goals. An agent cannot “implement Locked v1” because none is written.

### Feasibility of the implied fix (high)

FastAPI does **not** sync custom `RequestValidationError` handlers into OpenAPI (known framework behavior). Durable fix must change schema generation.

Probed on this repo’s FastAPI (≥0.115): constructing the app with

```python
app = FastAPI(..., responses={422: {"model": APIResponse}})
```

overrides all auto-422 refs to `#/components/schemas/APIResponse`, drops `HTTPValidationError` from components, and leaves success schemas unchanged. That is the minimal, global fix for ~65 operations — far better than per-route `responses=` or hand-editing `openapi.json` (CI re-dumps via `backend/scripts/dump_openapi.py` and would fight a manual patch).

Optional enrichment (not required by `fix_when`): a dedicated response model that types `error.details.errors` as the existing Pydantic error-item shape. Today `ErrorDetail.details` is opaque `dict | null`, which is already enough for FE (`ApiError.details`).

### What a Locked v1 would need before un-parking

1. **Approach:** Add `responses={422: {"model": APIResponse}}` on `FastAPI(...)` in `backend/app/main.py` (or equivalent custom `openapi()` rewrite if a richer validation envelope model is preferred). Do **not** change `validation_exception_handler`.
2. **Regen:** `poetry run python scripts/dump_openapi.py` → `cd frontend && npm run gen:api`; commit both artifacts.
3. **Acceptance checks:** No path `responses.422` refs `HTTPValidationError`; generated `schema.ts` 422 content uses `APIResponse` / `ErrorDetail`; optional unit/assert that dumped spec has zero `HTTPValidationError` (or CI dump+diff already covers once fixed).
4. **Non-goals:** No FE `client.ts` changes; no documenting every non-422 error status in this gap; no runtime envelope change.
5. **Risks / nits:** App-level `responses` merge must be re-verified after FastAPI upgrades; opaque `details` means generated types still won’t deep-type `errors[]` unless a richer model is locked; Swagger “Validation Error” description text may stay generic unless updated.

### Deferred / parked coherence

Parking is reasonable: SPA never consumes generated 422 types; live client already matches runtime. Closing later is a small, safe OpenAPI/codegen chore once a Locked v1 is written — until then, **NO_PLAN**.

## Closed

2026-08-10: `FastAPI(..., responses={422: {"model": APIResponse}})` in
`backend/app/main.py`. Dump + `gen:api` — zero `HTTPValidationError` in
components; all path 422s ref `APIResponse`. Runtime handler unchanged.
