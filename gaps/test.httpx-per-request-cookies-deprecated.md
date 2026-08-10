---
id: test.httpx-per-request-cookies-deprecated
title: Auth tests use deprecated httpx per-request cookies=
kind: test_gap
severity: P3
status: open
surface: auth
evidence:
  - path: backend/tests/test_auth_routes.py
    note: 10× post(..., cookies={REFRESH: ...}) including sequential refresh-race test
  - path: backend/tests/test_hardening.py
    note: 6× logout/refresh cookie cases via per-request cookies=
  - path: backend/tests/test_instagram_auth.py
    note: 1× OAuth state cookie via per-request cookies=
  - path: backend/tests/test_password_reset.py
    note: Precedent already uses app_client.cookies.set then bare post
  - path: backend/tests/conftest.py
    note: app_client is one AsyncClient per test with shared jar (base_url https://test)
  - path: backend/pyproject.toml
    note: httpx >=0.27 (locked 0.28.1); deprecation warn-only since 0.18
repro: |
  cd backend && poetry run pytest tests/test_auth_routes.py tests/test_hardening.py tests/test_instagram_auth.py -q
  # DeprecationWarning: Setting per-request cookies=<...> is being deprecated
fix_when: |
  All 17 per-request `cookies=` call sites in the three auth test files are
  migrated to client-jar set/replace. Pytest with
  `-W error::DeprecationWarning` on those files (plus password_reset) is green.
  Sequential refresh-race assertions still pass (exactly one cookie value sent).
  No warning filter as the “fix”.
---

## Context

httpx deprecates per-request `cookies=` because jar persistence semantics are
ambiguous. Buzz uses it to inject minted JWTs / OAuth state the server never
Set-Cookie’d. Not broken on locked httpx 0.28.1; future 1.0 may remove the API.

`test_refresh_concurrent_loser_preserves_winner_cookie` is **sequential**
(won → lost with old → again with winner), not `asyncio.gather`.

## Suggested Locked v1

1. Replace all **17** `cookies=` sites in
   `test_auth_routes.py` / `test_hardening.py` / `test_instagram_auth.py`.
2. Standard pattern before each explicit-cookie request: replace the jar
   (`app_client.cookies = httpx.Cookies({name: value})`) **or**
   `clear()` + `set` — then call without `cookies=`. Prefer replace after a
   rotating refresh so domain `''` vs Set-Cookie `test.local` does not leave
   dual jar entries / dual `Cookie` headers.
3. Race test: before **won**, jar = old; capture winner from response; before
   **lost**, jar = old only; before **again**, jar = winner only. Keep loser
   no Max-Age=0 wipe + winner still refreshes.
4. IG expired-state test: set OAuth-state cookie on the jar, then POST callback.
5. Optional thin conftest helper; do not invent Header-Cookie or private
   transport clones unless a test needs an isolated client.
6. Verify the listed files under `-W error::DeprecationWarning`.
7. Do **not** filter/silence the warning.

## Non-goals

- Changing refresh/logout/OAuth product cookie behavior
- True parallel race tests
- Frontend / Playwright / bugbash
- Pinning `httpx <1` as part of this gap’s DoD (optional separate chore)

## Residual risk

Naive `cookies.set` without clear/replace after Set-Cookie can yield two jar
entries and dual `buzz_refresh` headers (Starlette last-wins — race assertions
can silently lie). Shared fixture jar pollution across steps if replace is
skipped. Loose `httpx>=0.27` pin means a future 1.0 lock refresh could turn
warn into break — separate pin if desired.
