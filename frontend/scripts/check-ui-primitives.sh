#!/usr/bin/env bash
# Fail if pages still copy-paste form shells or native checkboxes.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/frontend/src"
fail=0

hit() {
  local label="$1"
  local pattern="$2"
  local out
  out="$(grep -nE "$pattern" "$SRC" --include='*.tsx' --include='*.ts' -r \
    --exclude-dir=theme \
    --exclude='controls.ts' \
    --exclude='shells.ts' \
    || true)"
  if [[ -n "$out" ]]; then
    echo "check-ui-primitives: $label"
    echo "$out"
    fail=1
  fi
}

hit "const inputClass leftover" 'const inputClass'
hit "Auth stack string leftover" 'mx-auto max-w-md px-8 py-16'
hit "native window.prompt leftover" 'window\.prompt\('
hit "native window.confirm leftover" 'window\.confirm\('
hit "native window.alert leftover" 'window\.alert\('

# Native checkboxes only allowed in the Checkbox primitive.
checkbox_hits="$(grep -nE 'type=["'\'']checkbox["'\'']' "$SRC" --include='*.tsx' -r | grep -v 'components/forms/Checkbox.tsx' || true)"
if [[ -n "$checkbox_hits" ]]; then
  echo "check-ui-primitives: native checkbox outside Checkbox.tsx"
  echo "$checkbox_hits"
  fail=1
fi

# Native <select> only allowed inside the Select primitive (controls.tsx).
select_hits="$(grep -nE '<select' "$SRC" --include='*.tsx' -r | grep -v 'components/forms/controls.tsx' || true)"
if [[ -n "$select_hits" ]]; then
  echo "check-ui-primitives: native <select> outside controls.tsx Select"
  echo "$select_hits"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
echo "check-ui-primitives: ok"
