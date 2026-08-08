---
name: simplify-pass
description: >-
  Post-change hygiene checklist before claiming done: scope, no new duplication,
  single SOT, naming consistency, dead code from this diff, openapi regen if
  routes changed, out-of-scope debt → gap file. Use after implementation and
  before ci-local / archive, or when the user says simplify-pass or simplify.
---

# Simplify pass

Run **after** implementation and **before** claiming ready / running archive CI.
Does not authorize large refactors or PRODUCT changes.

## Checklist (all must pass or be dispositioned)

1. **Scope** — Only files needed for the task; no unrelated drive-by edits.
2. **No new duplication** — No second copy of a helper/concern you touched. Prefer one function/module.
3. **Single SOT** — Do not copy PRODUCT §§ into ARCHITECTURE, rules, README, or comments. Point to PRODUCT/ARCHITECTURE/gaps instead.
4. **Naming consistency** — One name per concept across BE/FE/docs for symbols introduced or renamed in this diff.
5. **Dead code** — No unused exports, imports, flags, or branches introduced by this change.
6. **OpenAPI** — If routes or response schemas changed: `cd backend && poetry run python scripts/dump_openapi.py` then `cd ../frontend && npm run gen:api`; include both artifacts.
7. **Docs** — Update PRODUCT/ARCHITECTURE/gaps **only** when allowed (PRODUCT/behavior needs user ask). Fix doc drift you caused in agent OS docs if this change was docs-only.
8. **Out-of-scope debt** — If you see duplication you must not fix now → create `gaps/<id>.md` (use **file-gap** skill). Do not bury in chat.

## Out of scope unless user asks

Large refactors, un-parking openapi/auth DRY gaps, UI restyles, drive-by migrations.

## Done

Briefly confirm checklist in your reply (or list gap ids filed). Then proceed to `./scripts/ci-local.sh` when the parent skill/DoD requires it.
