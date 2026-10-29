#!/usr/bin/env bash
# Fail if product code re-implements something the design system already owns.
#
# This is the deterministic half of "does the UI look designed": taste is
# argued from screenshots, but a page reaching past a token for a raw utility
# is a fact a grep can settle. Every rule below maps to a defect class found in
# the revamp audit (ui-defect map (buzz-ops design/archive)).
#
# The design system itself is exempt: theme/ defines the tokens, and the
# primitives under components/forms/ + components/ui/ are where raw utilities
# are supposed to live.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/frontend/src"
fail=0

# Files allowed to contain raw utilities: they are the system.
PRIMITIVES='components/forms/|components/ui/|pages/dev/UiKitPage.tsx'

# hit <label> <pattern> <guidance>
hit() {
  local label="$1" pattern="$2" guidance="$3" out
  out="$(grep -nE "$pattern" "$SRC" --include='*.tsx' --include='*.ts' -r \
    --exclude-dir=theme || true)"
  if [[ -n "$out" ]]; then
    echo "check-ui-primitives: $label"
    echo "  -> $guidance"
    echo "$out"
    echo
    fail=1
  fi
}

# hit_outside_primitives <label> <pattern> <guidance>
hit_outside_primitives() {
  local label="$1" pattern="$2" guidance="$3" out
  out="$(grep -nE "$pattern" "$SRC" --include='*.tsx' --include='*.ts' -r \
    --exclude-dir=theme | grep -vE "$PRIMITIVES" || true)"
  if [[ -n "$out" ]]; then
    echo "check-ui-primitives: $label"
    echo "  -> $guidance"
    echo "$out"
    echo
    fail=1
  fi
}

# --- duplicated shells and native dialogs -----------------------------------

hit "const inputClass leftover" 'const inputClass' \
  "use the TextField/TextArea primitives"
hit "auth stack string leftover" 'mx-auto max-w-md px-[0-9]+ py-[0-9]+' \
  "use <AuthShell align=\"stack\"> instead of the literal shell classes"
hit "min-h-[60vh] leftover" 'min-h-\[60vh\]' \
  "centering comes from AUTH_SHELL.center + the SiteLayout flex column"
hit "native window.prompt leftover" 'window\.prompt\('  "use a Modal"
hit "native window.confirm leftover" 'window\.confirm\(' "use a Modal"
hit "native window.alert leftover" 'window\.alert\('    "use a Banner"

# --- controls ---------------------------------------------------------------

hit_outside_primitives "native checkbox outside the Checkbox primitive" \
  'type=["'\'']checkbox["'\'']' "import { Checkbox } from components/forms/controls"
hit_outside_primitives "native <select> outside the Select primitive" \
  '<select' "import { Select } from components/forms/controls"
hit_outside_primitives "bare <input> outside the field primitives" \
  '<input' "use TextField / DateTimeField (pass an explicit id)"
hit_outside_primitives "bare <textarea> outside the field primitives" \
  '<textarea' "use TextArea"

# --- tokens that exist and were being bypassed ------------------------------

hit_outside_primitives "stock Tailwind status colours" \
  '(text|bg|border|ring|divide)-(red|green|emerald|amber|yellow|orange|lime|teal)-[0-9]{2,3}' \
  "use TONE from theme/tokens, or the buzz-danger/success/warn tokens"
hit_outside_primitives "arbitrary z-index" \
  'z-\[[0-9]+\]' "use z-buzzDrawer / z-buzzBanner / z-buzzModal"
hit_outside_primitives "arbitrary micro font size" \
  'text-\[1[01]px\]' "use TEXT.micro (the buzzMicro token)"
hit_outside_primitives "font weight above semibold" \
  'font-(black|extrabold)' \
  "hierarchy comes from size and colour; TEXT caps weight at semibold"
hit_outside_primitives "stock Tailwind radius" \
  'rounded-(sm|md|lg|xl|2xl|3xl)([^a-zA-Z-]|$)' \
  "use rounded-buzzControl / rounded-buzzCard / rounded-buzzBoard / rounded-buzzModal, or the Card primitive"
hit_outside_primitives "stock Tailwind shadow" \
  'shadow-(sm|md|lg|xl|2xl)([^a-zA-Z-]|$)' \
  "use shadow-buzz / shadow-buzzLg, or the Card primitive"

# Legacy names that read backwards after the Pulse Black remap:
# `text-buzz-paper` is dark, `bg-buzz-ink` is light, `buzz-coral` / `buzz-cream`
# are the old accent and page. New files use the semantic aliases
# (bg-page, text-primary, text-on-accent, accent, accent-wash).
# Files that still carry the old names are pinned in the allowlist.
ALLOWLIST="$ROOT/frontend/scripts/ui-legacy-allowlist.txt"
legacy_hits="$(grep -lE 'text-buzz-paper([^A-Za-z0-9]|$)|bg-buzz-ink([^A-Za-z]|$)|buzz-coral|buzz-cream' \
  "$SRC" --include='*.tsx' --include='*.ts' -r --exclude-dir=theme || true)"
if [[ -n "$legacy_hits" ]]; then
  while IFS= read -r file; do
    rel="${file#"$SRC"/}"
    if ! grep -qxF "$rel" "$ALLOWLIST"; then
      echo "check-ui-primitives: legacy palette class in $rel"
      echo "  -> use bg-page, text-primary, text-muted, text-on-accent, accent, or accent-wash"
      echo
      fail=1
    fi
  done <<< "$legacy_hits"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "check-ui-primitives: FAILED"
  exit 1
fi
echo "check-ui-primitives: ok"
