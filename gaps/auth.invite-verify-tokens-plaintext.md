---
id: auth.invite-verify-tokens-plaintext
title: Brand invite and .edu verification tokens stored plaintext (reset is hashed)
kind: authz
severity: P1
status: open
surface: auth
evidence:
  - path: backend/app/models/brand_invite_token.py
    note: token column stores raw secret
  - path: backend/app/models/verification_token.py
    note: token column stores raw secret
  - path: backend/app/models/password_reset_token.py
    note: token_hash SHA-256 only — strong pattern to copy
  - path: backend/app/services/brand_auth.py
    note: create_brand_invite persists secrets.token_urlsafe(48) raw
repro: |
  SELECT token FROM brand_invite_tokens WHERE used_at IS NULL;
  SELECT token FROM email_verification_tokens WHERE used_at IS NULL;
  Redeem via set-password / verify-email without inbox access.
fix_when: |
  Invite and verify store only hashes (parity with password_reset); consume
  hashes the presented secret; tests assert no raw token column on mint.
---

# Invite / verify tokens plaintext at rest

Security audit 2026-08-11 (areas 5a/5b). Parent-verified. DB dump / backup leak
⇒ account setup or onboarding advance without mailbox.
