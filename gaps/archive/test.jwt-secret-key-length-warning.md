---
id: test.jwt-secret-key-length-warning
title: Pytest floods InsecureKeyLengthWarning from short SECRET_KEY
kind: test_gap
severity: P3
status: fixed
closed_in: 772305a
surface: auth
evidence:
  - path: backend/app/config.py
    note: _DEV_SECRET_KEY is "dev-secret-change-me" (20 bytes); off-dev guard is exact equality to that constant only
  - path: backend/.env.example
    note: Documents the same short SECRET_KEY default
  - path: backend/app/security/jwt.py
    note: All mint/verify use settings.SECRET_KEY + HS256; warning fires on encode and decode
  - path: backend/tests/test_hardening.py
    note: test_prod_config_rejects_dev_secret hardcodes the old literal
  - path: backend/tests/conftest.py
    note: No SECRET_KEY override; suite inherits Field default and/or backend/.env
repro: |
  cd backend && poetry run pytest -q
  # Hundreds of jwt.warnings.InsecureKeyLengthWarning (HMAC key is 20 bytes; need ≥32 for SHA256)
fix_when: |
  Local/CI pytest emits zero PyJWT InsecureKeyLengthWarning when using the
  committed default SECRET_KEY. Off-dev still rejects the historical literal
  `dev-secret-change-me` even after the default is lengthened. Settings default
  and `.env.example` stay consistent. No filterwarnings-only “fix”.
---

## Context

Noise-only today — tests pass; prod already blocks the committed default via
`Settings._forbid_default_secrets_outside_dev`. PyJWT 2.12.1
`HMACAlgorithm.check_key_length` requires ≥32 bytes for HS256 (RFC 7518 §3.2).

CI/E2E do not inject `SECRET_KEY` (Field default). Local gitignored
`backend/.env` may still override with the short string after a fix.

## Suggested Locked v1

1. In `backend/app/config.py`, set `_DEV_SECRET_KEY` to a new ≥32-byte committed
   default (keep a recognizable `dev-secret-change-me-…` prefix).
2. Introduce a forbidden-dev-secret set that always includes the **historical**
   literal `"dev-secret-change-me"` **and** the current `_DEV_SECRET_KEY`.
3. Change the off-dev guard to reject `SECRET_KEY` if it equals **any** forbidden
   string (not only `== _DEV_SECRET_KEY`).
4. Update `backend/.env.example` to the same new default; optional one-line note
   that HS256 wants ≥32 bytes.
5. Update `test_hardening.py` to assert rejection of the old literal (and
   preferably the shared forbidden constant / current default) so coverage cannot
   drift.
6. Do **not** silence via `filterwarnings` / pytest config.
7. Verify: `poetry run pytest -q` → zero `InsecureKeyLengthWarning`; hardening
   tests green. No Railway/prod secret rotation.

## Options (discarded / why)

| Option | Why not sole fix |
| --- | --- |
| Lengthen only in conftest | CI/E2E/uvicorn still inherit short Field default |
| Lengthen default without forbidding old string | Old public secret becomes allowed off-dev |
| filterwarnings | Papers over short key; fails `fix_when` |

## Non-goals

- Prod/Railway `SECRET_KEY` rotation
- Min-length validator for arbitrary custom secrets
- Changing `JWT_ALGORITHM` away from HS256
- Fernet / `TOKEN_ENCRYPTION_KEY` changes
- PRODUCT / SPA / OpenAPI

## Residual risk

Local `backend/.env` with the old short value keeps warnings until manually
updated. Outstanding local JWTs invalidate after a local secret change (re-login).
