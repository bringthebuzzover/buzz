---
id: auth.undecryptable-ig-ciphertext
title: Undecryptable IG ciphertext never forces re-auth
kind: silent_loss
severity: P2
status: fixed
closed_in:
surface: auth
evidence:
  - path: backend/app/services/instagram_token.py
    note: TokenDecryptionError skipped in jobs; login days_until_expiry never decrypts
repro: |
  Rotate TOKEN_ENCRYPTION_KEY without re-encrypt; org looks authenticated; IG calls fail silently.
fix_when: |
  Undecryptable tokens force reconnect / clear ciphertext and surface to org/admin.
---

If `TOKEN_ENCRYPTION_KEY` is rotated without re-encrypting rows, `decrypt_token`
raises `TokenDecryptionError`. `metric_sync` / `token_refresh` catch and skip; on
login, `days_until_expiry` never decrypts so a future `expires_at` looks fine.
The org stays "authenticated" while every IG call silently fails.
