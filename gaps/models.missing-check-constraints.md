---
id: models.missing-check-constraints
title: No DB CheckConstraints for capacity, units, or apply window
kind: invariant_break
severity: P3
status: deferred
surface: models
evidence:
  - path: backend/app/models/drop.py
    note: capacity_total / total_product_units / apply window have no CheckConstraint; units docstring says NULL or >= 1
  - path: backend/migrations
    note: zero CHECK constraints in migration tree (uniques/partial uniques only)
  - path: backend/app/schemas/drops.py
    note: BrandDropCreateRequest is title+description only
  - path: backend/app/services/drops.py
    note: create_brand_drop hardcodes capacity=10, open+1d/close+8d, units=None — always valid
  - path: backend/app/services/admin.py
    note: admin drop routes never mutate capacity, units, or apply window
  - path: gaps/brand.drop-create-thin.md
    note: first product write path for these fields — ship CHECKs with that work
repro: |
  Product API cannot reproduce bad data (create always yields valid defaults).
  SQL layer still accepts:
    UPDATE drops SET capacity_total = 0 …;
    UPDATE drops SET total_product_units = 0 …;
    UPDATE drops SET apply_open_at = apply_close_at + interval '1 day' …;
  Then SELECT rows with capacity_total <= 0 OR units <= 0 OR open >= close.
fix_when: |
  Alembic + Drop model declare **named** CheckConstraints (required for
  `alembic check` / model parity):
  `ck_drops_capacity_positive`: capacity_total >= 1;
  `ck_drops_units_null_or_positive`: total_product_units IS NULL OR
  total_product_units >= 1;
  `ck_drops_apply_window_ordered`: apply_open_at < apply_close_at;
  **IN v1:** `ck_drop_applications_allocated_units_nonneg`: allocated_units IS
  NULL OR allocated_units >= 0 on drop_applications.
  Preflight SELECT (abort on dirty rows, same discipline as social_posts unique
  migration) then ADD … NOT VALID + VALIDATE. test_constraints pins rejection
  via SQL. Ship **immediately after** brand.drop-create-thin Phase 1 (or same
  cluster after PATCH) — never block Phase 1 archive. App validators remain
  the client-facing gate; CHECKs are defense-in-depth.
---

## Problem

There are zero `CheckConstraint` / SQL `CHECK` declarations for drop capacity,
product units, or apply-window order. Bad values are storable at the Postgres
layer.

## Contradicts prior P1 framing

**Not a live prod-correctness hole today.** No brand/org/admin API write path
can insert or update these columns to invalid values:

- Brand create hardcodes valid defaults (`capacity_total=10`, ordered window,
  `total_product_units=None`).
- Admin never mutates capacity / units / window.
- Finalize only writes `allocated_units` on applications (Pydantic `units >= 0`
  + budget/capacity caps) — does not rewrite drop capacity/window/budget.

Bad rows require **raw SQL** (or a future config API that ships without
validators). Softened **P1 → P3** (or P2 only when paired with
`brand.drop-create-thin`). Keep deferred/parked.

If bad rows existed via SQL, behavior is mostly fail-closed (immediate
capacity Closed / no usable Open interval / finalize budget rejects) — ops
weirdness, not an exploit.

## Locked v1 fix

1. Model `__table_args__` + Alembic migration with **named** CHECKs above
   (including allocated_units).
2. Preflight → `postgresql_not_valid=True` → `VALIDATE CONSTRAINT`.
3. Extend `test_constraints.py` with raw-SQL negative cases; keep
   `test_alembic_matches_models` / `alembic check` green.
4. Timing: **after** `brand.drop-create-thin` Phase 1 (or paired follow-up in
   the same cluster after PATCH). Do not block Phase 1 archive.
5. API UX: keep drop-config Pydantic/business validators as the user-facing
   422/400 path — do not rely on raw IntegrityError for SPA copy.

## Notes vs prior gap text

Dropped unrelated SQL probes (stranded `applied` after finalize; org users
without organization rows) — those belong to other gaps / archives, not
CheckConstraints.

## Plan verification

**Verdict: PASS_WITH_NITS**

Verified against `backend/app/models/drop.py`, `application.py`,
`services/drops.create_brand_drop`, migration tree (zero CHECKs today),
`test_constraints.py` / `test_migrations.py` (`alembic check` parity),
`gaps/brand.drop-create-thin.md` Phase 1 lock, and Postgres/Alembic support
in this repo (`sqlalchemy>=2.0`, `alembic>=1.13`).

### CHECK SQL correctness — PASS

| Constraint | Expression | Assessment |
| --- | --- | --- |
| Capacity | `capacity_total >= 1` | Correct. Column is `NOT NULL`; matches create default `10`, Drop docstring, and `brand.drop-create-thin` `ge=1` / explicit-null→422. |
| Units | `total_product_units IS NULL OR total_product_units >= 1` | Correct. Encodes spot-only (`NULL`) vs unit-allocated (`>= 1`) from model docstring + PRODUCT §4.1. Rejects `0` / negatives. |
| Window | `apply_open_at < apply_close_at` | Correct. Aligns with drop-config matrix rejecting merged `open >= close` (strict inequality; equal window invalid). Create path uses `+1d` / `+8d`. |
| Optional apps | `allocated_units IS NULL OR allocated_units >= 0` | Correct vs finalize `units >= 0`. Does **not** encode cross-row rules (accepted-only, budget sum) — those cannot be single-column CHECKs; correctly left to app layer. |

Postgres note: `CHECK (total_product_units >= 1)` alone already allows `NULL` (NULL predicate → CHECK passes). The explicit `IS NULL OR …` form is redundant but clearer and preferred for intent documentation. Keep it.

Seeds (`seed_dev.py`, `seed_e2e.py`) and tests already invent valid capacity/window/units; no known fixture conflicts.

### NOT VALID / VALIDATE feasibility — PASS (with implementer notes)

- **Feasible here.** Alembic supports
  `op.create_check_constraint(..., postgresql_not_valid=True)` and
  `op.execute(sa.text("ALTER TABLE drops VALIDATE CONSTRAINT <name>"))`.
- **Preflight pattern already exists** in this repo:
  `c9d0e1f2a3b4_social_posts_unique_per_org.py` SELECT → `RuntimeError` on dirty
  data. Mirror that for:

  ```sql
  SELECT id FROM drops WHERE capacity_total < 1
     OR (total_product_units IS NOT NULL AND total_product_units < 1)
     OR apply_open_at >= apply_close_at;
  ```

  Abort migration on hits; repair is ops, not silent rewrite in the migration.
- **Same-revision ADD NOT VALID + VALIDATE** is acceptable for the small
  `drops` table. Splitting VALIDATE into a second revision is optional
  lock-hygiene, not required for correctness if preflight is clean.
- **Model must declare named `sa.CheckConstraint`s** on `Drop` (and optional
  `DropApplication`) so `test_alembic_matches_models` / `alembic check` stay
  green. Do **not** leave `postgresql_not_valid=True` on the ORM metadata —
  end state after VALIDATE is a normal CHECK; model should match end state.
- Named constraints are mandatory for VALIDATE + downgrade
  (`op.drop_constraint`). Propose e.g. `ck_drops_capacity_total`,
  `ck_drops_total_product_units`, `ck_drops_apply_window` (and optional
  `ck_drop_applications_allocated_units`).
- Tests: extend `test_constraints.py` with raw-SQL UPDATE/INSERT that bypass
  ORM, expect `IntegrityError` (CheckViolation) — same spirit as
  `test_pg_enum_rejects_invalid_value`.

### Nullable units conflict — PASS (no conflict)

`total_product_units` NULL remains valid under the proposed CHECK. Brand create
hardcodes `None`; drop-config Phase 1 explicitly allows clearable JSON `null`
→ spot-only. No tension with capacity/window CHECKs (those columns are
non-null). Mode-flip / budget floors stay application-layer (400/409), not DB
CHECK — correct split.

### Timing / pairing with `brand.drop-create-thin` — PASS_WITH_NITS

Locked sister plan:

- Phase 1 admin PATCH + Pydantic validators are **mandatory**.
- DB CHECKs are **explicitly OUT of Phase 1** (`brand.drop-create-thin` §7);
  ship as immediate follow-up / paired defense-in-depth (Phase 2 bullet).
- This gap’s “prefer shipping with” is compatible if read as **not blocking
  Phase 1 archive**, not “same PR / same Phase 1 commit.”

Safe orderings:

1. **CHECKs after Phase 1** (preferred by brand gap) — validators already
   prevent IntegrityError on the new write path; CHECKs catch SQL/bypass.
2. **CHECKs before Phase 1** — also safe today: only writers are create
   defaults + seeds (always valid). No product path can violate yet.
3. **Same swarm as Phase 1** — fine if CHECKs do not gate archiving
   `brand.drop-create-thin`; keep IntegrityError from reaching clients
   (validators first, as drop-config already locks).

Do **not** un-park this gap alone for urgency (gap body + CLUSTERS `parked`) —
agreed.

### Nits (fix before implement) — amended into Locked v1 (2026-08-06)

Folded: timing after Phase 1; full SQL expressions; named constraints + model
`__table_args__` for alembic check; `allocated_units` CHECK **IN** v1.

### Bottom line

Expressions match product + Drop semantics; nullable units are preserved;
NOT VALID → VALIDATE is supported and fits existing migration discipline;
pairing with drop-config is sequenced correctly as defense-in-depth after
(or beside) the first config write path. Nits are specification polish for
implementers, not technical blockers.
