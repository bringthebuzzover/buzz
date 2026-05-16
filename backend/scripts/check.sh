#!/usr/bin/env bash
# Local quality gate: format with Black, then lint with Ruff, then run pytest.
# Each stage short-circuits the next on failure (set -e). Use --check to make
# Black non-mutating (handy for CI / pre-push). Run from any CWD.
#
# Usage:
#   ./scripts/check.sh         # format in-place, lint, test
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
echo "==> [1/3] Black ${BLACK_ARGS[*]:-(format in place)}"
poetry run black ${BLACK_ARGS[@]+"${BLACK_ARGS[@]}"} "${TARGETS[@]}"

echo
echo "==> [2/3] Ruff (lint)"
poetry run ruff check "${TARGETS[@]}"

echo
echo "==> [3/3] Pytest"
poetry run pytest

echo
echo "All checks passed."
