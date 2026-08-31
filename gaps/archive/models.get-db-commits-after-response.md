---
id: models.get-db-commits-after-response
title: get_db committed flushed writes only after FastAPI had already sent the body
kind: invariant_break
severity: P1
status: fixed
surface: models
evidence:
  - path: backend/app/deps/db.py
    note: request-scoped yield deps exit after await response(); function-stack commit runs before send
  - path: backend/app/services/drop_requests.py
    note: create_brand_drop_request only flush()es; list refetch can miss the new row
  - path: frontend/src/api/hooks/useBrandHooks.ts
    note: useCreateBrandDropRequest invalidates brand-drop-requests on success (staleTime 30s)
  - path: frontend/e2e/brand.spec.ts
    note: "E2E plan campaign ticket" assertion races the uncommitted INSERT
repro: |
  E2E stress run 33436711584 shard 29 (brand.spec.ts:37). Playwright network:

      POST /api/auth/brand/login         200
      GET  /api/brands/me/drop-requests  200
      POST /api/brands/me/drop-requests  200
      GET  /api/brands/me/drop-requests  200   ← 27ms later; new ticket missing

  Toast (client-side) was visible; the list refetch was not. Same FastAPI
  ordering as auth.mint-bump-not-durable-before-response: body sent before
  get_db's after-yield commit. Not caused by commit_revocation.
fix_when: |
  Flush-only mutations are durable before the HTTP body is sent, so a client
  that immediately GETs what it just POSTed cannot miss the row. Do not fix
  only create_brand_drop_request — every invalidateQueries-after-mutation
  path has the same race.
---

# get_db committed after the response

FastAPI 0.136 `request_response` exits `fastapi_function_astack` before
`await response(...)` and `fastapi_inner_astack` (request-scoped yield
dependencies, including `get_db`) after. A second connection can therefore
miss an INSERT the handler already flushed.

Fixed by entering a success-only commit context on `fastapi_function_astack`
inside `get_db`. Generator-driven unit tests have no function stack and still
commit after `yield`. `issue_token_pair` / `commit_revocation` early commits
stay; they are extra empty commits on this path.

`app_client` still replaces `get_db` entirely (rolled-back test session).
