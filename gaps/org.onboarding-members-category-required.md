---
id: org.onboarding-members-category-required
title: Org profile required fields wrong — followers on create; members/type/city/state/contact/delivery optional
kind: ux_hole
severity: P2
status: open
surface: org
evidence:
  - path: frontend/src/pages/onboarding/OrgProfilePage.tsx
    note: Create collects optional followers/members/category + deliveryAddress; city/state/contactName absent from form/payload
  - path: frontend/src/pages/org/OrgPortalProfilePage.tsx
    note: Edit labels city/state/contact/members/category/followers/delivery optional; empty → null clears on PATCH
  - path: backend/app/schemas/onboarding.py
    note: OrgOnboardingRequest only requires org_name/university/edu_email; profile fields + follower Optional
  - path: backend/app/schemas/orgs.py
    note: OrgProfileUpdate allows null-clear for member/category/city/state/contact/delivery/follower
  - path: backend/app/services/onboarding.py
    note: submit_org_onboarding persists client follower_count; does not Graph-seed followers
  - path: backend/app/services/auth.py
    note: IG callback already fetch_profile (includes followers_count) but org row does not exist yet — value discarded
  - path: backend/app/jobs/metric_sync.py
    note: Daily _refresh_follower_counts writes organizations.follower_count from Graph for tokened orgs
  - path: backend/app/models/organization.py
    note: member_count/category/city/state/contact_name/follower_count/delivery_address all nullable=True
  - path: backend/app/services/admin_erase.py
    note: Erase scrub nulls member/category/city/state/contact/delivery; keeps follower_count + university
  - path: frontend/src/components/brand/ApiDropOrgTable.tsx
    note: Brand category filter only lists non-null categories; null-category orgs vanish when a type is selected
  - path: PRODUCT.md
    note: §3.1 short profile; §4.3 still says manual follower edits allowed (to change); §5.3.1 brand type filter
  - path: gaps/CLUSTERS.md
    note: Cluster org-onboarding-required-fields; decisions locked 2026-08-11 (see Intent)
repro: |
  Create: submit onboarding with only org name, university, .edu — succeeds with
  null member_count/category/city/state/contact/delivery; followers optional
  and persisted if sent.
  Edit: PATCH /api/orgs/me can omit or clear those fields (and followerCount).
fix_when: |
  **Create** (`/onboarding/profile` + `OrgOnboardingRequest`):
  - Omit `follower_count` from create schema (extra=forbid → 422 if sent).
    Never accept client-supplied followers.
  - **Trigger on create:** after the org row is created in
    `submit_org_onboarding`, best-effort Graph `fetch_profile` with the user's
    token → set `organizations.follower_count`. On any failure (missing/expired
    token, decrypt error, Graph error, omitted `followers_count`): leave null,
    **do not fail onboarding**, and **log a warning** with org_id/user_id/reason
    (same spirit as `metric_sync` follower fail/omit logs). Daily job backfills.
  - Require: member_count, category, city, state, contact_name, delivery_address.
  - Add city, state, contact name to the creation form; mark delivery required.

  **Edit** (`/org/profile` + `OrgProfileUpdate`):
  - Same six fields required on SPA; cannot clear to null/blank via PATCH (422).
  - Omit `follower_count` from PATCH schema (read-only / Graph-owned).
  - Legacy rows with nulls: no backfill; omit-on-PATCH leaves prior null;
    SPA blocks save until filled when user edits profile.

  FE + API + OpenAPI + tests. Update PRODUCT §3.1 (required set) and §4.3
  (remove manual follower edits; Graph-only).
---

# Org profile: required fields on create + edit

## Intent (locked by asks 2026-08-11; refined same day)

### Decisions

1. **Required set (create + edit):** `member_count`, `category`, `city`,
   `state`, `contact_name`, **`delivery_address`**.
2. **Legacy nulls:** keep as-is — no backfill migration, no DB `NOT NULL`
   (erase scrub must keep nulling contact/shipping PII). New creates enforce
   requiredness; PATCH rejects clear-to-null; omit leaves prior value
   (legacy nulls persist until the org edits profile).
3. **Followers:** Graph-only — never manually populated. Remove from create
   and edit forms and from write schemas. Daily job remains ongoing SOT.
4. **Create-time Graph seed (locked):** on org profile creation, trigger a
   best-effort Instagram Graph follower fetch and write
   `organizations.follower_count`. Failures must **log** (warning + reason)
   and leave null — never block onboarding.

### Create (pending profile submit)

1. **Remove** follower count from the form and create API (forbid client write).
2. **Require** members, org type, city, state, contact name, delivery address.
3. **Add** city, state, contact name to the creation form.
4. **Graph-seed followers** after insert (best-effort + log on failure).

### Edit (`PATCH /api/orgs/me`)

The six required fields cannot be cleared to null/blank. Followers are not
editable (Graph-owned). Read-only display of follower count on portal/admin
is fine.

## As-built

| Field | SPA create | API create | SPA edit | API PATCH |
| ----- | ---------- | ---------- | -------- | --------- |
| `followerCount` | Optional (shown) | Optional; **persisted** if sent | Optional | Optional / clearable |
| `memberCount` | Optional | Optional | Optional | Optional / clearable |
| `category` | Optional | Optional | Optional | Optional / clearable |
| `city` | **Missing** | Optional (accepted, unused by SPA) | Optional | Optional / clearable |
| `state` | **Missing** | Optional (accepted, unused by SPA) | Optional | Optional / clearable |
| `contactName` | **Missing** | Optional (accepted, unused by SPA) | Optional | Optional / clearable |
| `deliveryAddress` | Optional (present) | Optional | Optional | Optional / clearable |

Notes:

- IG OAuth already calls `fetch_profile` (includes `followers_count`) but the
  org row does not exist yet — value is discarded until profile submit / job.
- Daily `metric_sync._refresh_follower_counts` already Graph-writes for every
  non-erased org with a usable token.
- DB columns remain nullable (required for erase + legacy).

## Followers Graph-only — feasibility

**Yes.** Already half-built:

| Piece | Today | Needed |
| ----- | ----- | ------ |
| Daily Graph refresh | `metric_sync` | Keep |
| Create-time seed | None (client may supply) | In `submit_org_onboarding`: decrypt token → `fetch_profile` → set `follower_count`; on failure **log warning** + leave null |
| OAuth `followers_count` | Fetched, discarded (no org row yet) | Not stashed; re-fetch at create (above) |
| Client create/edit write | Allowed | **Remove** from `OrgOnboardingRequest` + `OrgProfileUpdate` + both SPA forms |
| PRODUCT §4.3 | “manual … edits remain allowed” | **Change** to Graph-only |

Caveats (acceptable under locked intent):

- Count may be **null** if create-time seed fails — brand UI already shows
  “—” / reach 0; daily job backfills. Failure path must still **log**.
- Job failed refresh keeps prior DB value (unchanged).

## PRODUCT updates required at implement

- §3.1 / §6.1: short profile includes members, org type, city, state, contact
  name, delivery address (required).
- §4.3: drop manual follower edits; followers Graph-refreshed only.

## Blast radius / related paths

| Path | Role | Change |
| ---- | ---- | ------ |
| `schemas/onboarding.py` + `services/onboarding.py` | Create | Require six fields; omit follower; Graph-seed + log on fail |
| `schemas/orgs.py` + `services/orgs.py` | PATCH | Require six (reject null clear); omit follower |
| `OrgProfilePage.tsx` / `OrgPortalProfilePage.tsx` | SPA | Forms/labels/payload; followers display-only or hidden on edit |
| `openapi.json` + `gen:api` | Contract | Regen |
| Tests / `_VALID_PROFILE` / seeds | CI | Fill required fields on create paths |
| `admin_erase` | Erase | Unchanged (still nulls PII; DB stays nullable) |
| Brand/admin read UIs | Display | No write-path change |

Related open gaps:

- `org.edu-email-change-after-verify`
- `org.verify-email-auto-consumes-token`

## Residual risks

1. Legacy nulls until next profile edit (accepted).
2. Brief null follower window if Graph seed fails at submit (must log; daily
   job backfills).
3. PRODUCT wording must ship with the behavior change.
4. Test coverage for create/edit requiredness + follower write rejection.

## Out of scope unless asked

- Backfill migration / DB `NOT NULL`.
- Changing erase scrub or KPI retention of `follower_count`.
- Exposing `contact_name` to brand applicant schemas.
- Forcing a soft-gate modal for legacy orgs that never open profile.
