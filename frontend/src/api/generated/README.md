# Generated API types

`schema.ts` is **auto-generated** from the backend OpenAPI spec — do not edit by
hand. It is the single source of truth for request/response shapes, so a backend
contract change becomes a TypeScript error in the frontend instead of a silent
runtime drift (the bug class behind the `accessToken`/`access_token` and
snake/camel issues).

## Regenerating

Run from the repo root:

```bash
# 1. Re-dump the spec from the backend (when a route's request/response changed):
cd backend && poetry run python scripts/dump_openapi.py   # writes ../openapi.json (repo root)

# 2. Regenerate the TS types from it:
cd ../frontend && npm run gen:api                         # reads ../openapi.json, writes this file
```

CI fails if either is stale (`openapi.json` vs routes, or `schema.ts` vs
`openapi.json`), so the contract can't drift unnoticed.

## Using it

Alias hand-written types to the generated ones as endpoints adopt the typed
`DataResponse[T]` envelope on the backend. Example (`src/api/hooks/useBrandHooks.ts`):

```ts
import type { components } from "../generated/schema";
export type BrandProfile = components["schemas"]["BrandProfileResponse"];
```

The more endpoints that return `DataResponse[T]` (vs untyped `APIResponse`), the
more of the contract is type-checked for free.
