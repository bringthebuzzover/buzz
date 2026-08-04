#!/usr/bin/env bash
# Full local CI gate — mirrors `.github/workflows/ci.yml` as closely as practical.
#
#   Backend:  black --check → ruff → mypy → openapi dump/diff → alembic upgrade → pytest
#   Frontend: tsc → gen:api diff → build
#   E2E:      Playwright with CI=true (fresh webServers; always runs)
#
# Usage (from repo root):
#   ./scripts/ci-local.sh
#
# Prereqs: Postgres reachable via DATABASE_URL (default matches local .env),
# Poetry backend deps, frontend npm deps, Playwright chromium installed.
#
# Env:
#   DATABASE_URL   asyncpg URL (default: postgresql+asyncpg://localhost/buzz)
#   ENVIRONMENT    passed through to E2E/backend (default: development)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://localhost/buzz}"
export ENVIRONMENT="${ENVIRONMENT:-development}"

die() { echo "error: $*" >&2; exit 1; }

if ! command -v poetry >/dev/null 2>&1; then
  die "poetry not found"
fi
if ! command -v npm >/dev/null 2>&1; then
  die "npm not found"
fi

free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti ":${port}" 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "==> Freeing port ${port} (PIDs: ${pids})"
    # shellcheck disable=SC2086
    kill ${pids} 2>/dev/null || true
    sleep 1
  fi
}

echo "==> [backend 1/6] Black --check"
(
  cd backend
  poetry run black --check --diff app/ tests/
)

echo
echo "==> [backend 2/6] Ruff"
(
  cd backend
  poetry run ruff check app/ tests/
)

echo
echo "==> [backend 3/6] mypy"
(
  cd backend
  poetry run mypy app/
)

echo
echo "==> [backend 4/6] OpenAPI dump + diff"
(
  cd backend
  poetry run python scripts/dump_openapi.py
  git -C "$ROOT" diff --exit-code -- openapi.json \
    || die "openapi.json drifted from routes — commit the dump_openapi.py output"
)

echo
echo "==> [backend 5/6] Alembic upgrade head"
(
  cd backend
  poetry run alembic upgrade head
)

echo
echo "==> [backend 6/6] Pytest"
(
  cd backend
  poetry run pytest -q
)

echo
echo "==> [frontend 1/3] TypeScript"
(
  cd frontend
  npx tsc --noEmit
)

echo
echo "==> [frontend 2/3] Generated API types in sync"
(
  cd frontend
  npm run gen:api
  git -C "$ROOT" diff --exit-code -- frontend/src/api/generated/schema.ts \
    || die "schema.ts drifted — run npm run gen:api after openapi changes and commit"
)

echo
echo "==> [frontend 3/3] Production build"
(
  cd frontend
  CI=true npm run build
)

echo
echo "==> [e2e] Playwright (CI=true)"
# CI mode does not reuse existing servers; free common local ports first.
free_port 8000
free_port 3000
(
  cd frontend
  # Idempotent when browsers are already present.
  npx playwright install chromium
  CI=true npm run e2e
)

echo
echo "All local CI checks passed (backend + frontend + E2E)."
