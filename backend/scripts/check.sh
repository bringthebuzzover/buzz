#!/usr/bin/env bash
# Local quality gate — same order CI runs in:
#   Black -> Ruff -> mypy -> Alembic (apply + drift) -> pytest
# Each stage short-circuits the next on failure (`set -e`). Pass `--check`
# to skip in-place reformatting (handy for CI / pre-push hooks). Run from
# any CWD; the script chdirs into `backend/` itself.
#
# Usage:
#   ./scripts/check.sh         # format in place, lint, type-check, test
#   ./scripts/check.sh --check # verify formatting without rewriting (CI mode)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

BLACK_ARGS=()
if [[ "${1:-}" == "--check" ]]; then
  BLACK_ARGS+=("--check" "--diff")
fi

TARGETS=("app/" "tests/")

# `${arr[@]+"${arr[@]}"}` is the portable empty-array guard for `set -u`
# (Bash 3.2 on macOS otherwise errors on the empty expansion).
echo "==> [1/4] Black ${BLACK_ARGS[*]:-(format in place)}"
poetry run black ${BLACK_ARGS[@]+"${BLACK_ARGS[@]}"} "${TARGETS[@]}"

echo
echo "==> [2/4] Ruff (lint)"
poetry run ruff check "${TARGETS[@]}"

echo
echo "==> [3/5] mypy (type-check)"
poetry run mypy app/

echo
echo "==> [4/5] Alembic (apply migrations + model/migration drift)"
# Catches what tests miss: tests build the schema with create_all, so a model
# change without a matching migration still passes pytest but breaks CI / a real
# deploy. `upgrade head` proves migrations apply; `check` proves no drift.
poetry run alembic upgrade head
poetry run alembic check

echo
echo "==> [5/5] Pytest"
poetry run pytest -v

echo
echo "All checks passed."
