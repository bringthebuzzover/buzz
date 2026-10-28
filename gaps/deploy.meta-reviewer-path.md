---
id: deploy.meta-reviewer-path
title: Temporary Meta App Review reviewer link (flag off by default)
kind: ops
severity: P1
status: ops
surface: deploy
evidence:
  - path: backend/app/services/auth.py
    note: Unknown Instagram accounts still get ORG_APPLY_REQUIRED; the reviewer path does not insert them
  - path: backend/app/meta_reviewer/REMOVAL.md
    note: File list and data cleanup for deleting the path
  - path: gaps/deploy.meta-app-review.md
    note: Resubmission should use this link instead of Buzz tester credentials
repro: |
  With META_REVIEWER_ACCESS_ENABLED unset or false, POST /api/meta-reviewer/start
  and POST /api/meta-reviewer/seed return 404 and do not write users.
  With the flag true, a SHA-256 hash in META_REVIEWER_LINK_SECRET_HASH, and
  META_REVIEWER_DROP_ID set to an existing drop, an admin POST
  /api/meta-reviewer/seed creates one active org named "Meta App Review" and
  accepts it on that drop. The link {FRONTEND_URL}/meta-review#{secret} binds
  one Business/Creator Instagram account to that org and runs metric sync for
  that org only.
fix_when: |
  App Review no longer needs a Buzz-side bypass of apply, admin approval, and
  the one-time Connect link. META_REVIEWER_ACCESS_ENABLED is off, the reviewer
  org is purged, and the files in backend/app/meta_reviewer/REMOVAL.md are
  deleted. Then move this file to gaps/archive/ with status fixed.
---

# Temporary Meta App Review reviewer path

Meta reviewers must use their own Instagram professional account. Buzz cannot
hand them Instagram credentials, and they cannot wait on `.edu` verification
or admin approval. This path is the temporary way in. It is **off** unless
`META_REVIEWER_ACCESS_ENABLED` is true.

Normal `/login` still returns `ORG_APPLY_REQUIRED` for an unknown Instagram
account. `/org/apply` is unchanged. The one-time Connect link
(`ORG_CONNECT_TOKEN_TTL_DAYS`, 7 days) is unchanged.

## Operator setup

Env vars (set on the Railway **api** service, never commit values):

| Name | Role |
| --- | --- |
| `META_REVIEWER_ACCESS_ENABLED` | `true` to enable. Default `false`. |
| `META_REVIEWER_LINK_SECRET_HASH` | SHA-256 hex of the link secret. Not the secret. |
| `META_REVIEWER_DROP_ID` | Existing drop UUID. Prod test drop: `647ea986-5af0-44c8-b5ff-03cbddf2d2fd`. |
| `META_REVIEWER_ORG_EMAIL` | Optional. Default `meta-app-reviewer@review.buzz.invalid`. |

Mint a link (prints the secret once; store the hash in Railway):

```bash
cd backend && poetry run python -m app.meta_reviewer.cli mint-link
```

Seed (idempotent; does not create the drop). Flag must be on and the drop
must already exist. Admin HTTP is the same operation:

```bash
cd backend && poetry run python -m app.meta_reviewer.cli seed
# or POST /api/meta-reviewer/seed as an active admin
```

Rotate by minting again and replacing `META_REVIEWER_LINK_SECRET_HASH`. The
old link fails on the next boot. Flag off 404s the routes immediately.

The link is `{FRONTEND_URL}/meta-review#{secret}`. The secret is in the
fragment so API access logs do not see it. After connect, the reviewer is
the seeded org only: no admin, no other org's campaigns, no apply / notify /
profile edit / IG-change ticket. A later connect with a different Instagram
account replaces the handle and drops the previous account's posts. That
handle is free again; `/login` with the old account is `ORG_APPLY_REQUIRED`.

Sync runs for that org only, then autolink for that org on the configured
drop. Autolink still no-ops unless the drop is `awaiting_products` or
`drop_active`, the brand has a handle, and a caption matches. Manual post
link works until the drop is `drop_finished`.

This does not add Instagram Testers in Meta and does not bypass Development
mode for the public. It only removes Buzz's apply and approval wait for the
one seeded org.

Removal: [`backend/app/meta_reviewer/REMOVAL.md`](../backend/app/meta_reviewer/REMOVAL.md).
