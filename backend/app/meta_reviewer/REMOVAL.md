# Remove the Meta App Review reviewer path

The path is temporary. Flag off already makes every reviewer route 404 and
leaves `/login`, apply, and Connect unchanged. Deleting the code is the
follow-up once App Review no longer needs it.

## 1. Turn it off

On the Railway **api** service, set `META_REVIEWER_ACCESS_ENABLED=false` (or
delete the variable) and redeploy. The link stops working on the next boot.
No database change is required for that.

## 2. Delete the reviewer org

Run this **before** deleting the module, from `backend/` with production
`DATABASE_URL` only if you intend to touch production:

```bash
poetry run python -m app.meta_reviewer.cli purge --yes
```

`purge` deletes the user whose email is `META_REVIEWER_ORG_EMAIL` (default
`meta-app-reviewer@review.buzz.invalid`) only when that row is an org named
`Meta App Review`. It deletes that org's posts, suggestions, links,
applications, and the user. It does **not** delete the test drop.

If the module is already gone, the same cleanup in SQL (replace the email
if you set `META_REVIEWER_ORG_EMAIL`):

```sql
-- Read first.
SELECT u.id AS user_id, o.id AS org_id
FROM users u
LEFT JOIN organizations o ON o.user_id = u.id
WHERE u.edu_email = 'meta-app-reviewer@review.buzz.invalid'
  AND o.org_name = 'Meta App Review';

-- Then, in one transaction, delete dependent rows for that org_id / user_id:
-- post_campaign_suggestions, post_campaign_links, social_posts,
-- drop_application_shipments, notify_me, drop_apply_intents,
-- org_ig_change_requests, org_connect_tokens, drop_applications,
-- email_verification_tokens, password_reset_tokens, organizations, users.
-- Do not delete the drops row.
```

## 3. Delete the code

Delete the whole package:

- `backend/app/meta_reviewer/` (this file, gate, seed, callback, routes, cli)

Delete the frontend module:

- `frontend/src/meta-reviewer/`

Delete the marked `META-REVIEWER-PATH` lines in:

- `backend/app/config.py` — `META_REVIEWER_ACCESS_ENABLED`, `META_REVIEWER_LINK_SECRET_HASH`, `META_REVIEWER_DROP_ID`, `META_REVIEWER_ORG_EMAIL`
- `backend/app/security/jwt.py` — `reviewer` claim and the `reviewer` argument on `create_oauth_state_token`
- `backend/app/routes/auth.py` — the callback branch that calls `complete_reviewer_instagram_callback`
- `backend/app/main.py` — the import and `include_router` for the reviewer router
- `backend/app/jobs/autolink_scan.py` — the optional `org_id` argument and its `WHERE` (only if nothing else uses it)
- `backend/app/services/drops.py` — `reject_reviewer_mutation` import and the three calls
- `backend/app/services/ig_change_requests.py` — import and the call in `submit_request`
- `backend/app/routes/orgs.py` — import and the call in `update_my_org`
- `frontend/src/AppRoot.tsx` — the import and the `/meta-review` route

Delete the tests:

- `backend/tests/test_meta_reviewer.py`
- `frontend/src/meta-reviewer/*.test.ts` and `*.test.tsx` (they live in the module directory above)

Regenerate the contract after the routes are gone:

```bash
cd backend && poetry run python scripts/dump_openapi.py
cd ../frontend && npm run gen:api
```

Remove the env example and checklist lines in `backend/.env.example` and
`DEPLOYMENT.md`. Point `LAUNCH.md` and `gaps/deploy.meta-app-review.md` back
at seeded tester onboarding only. Move `gaps/deploy.meta-reviewer-path.md` to
`gaps/archive/` with `status: fixed`.

## 4. Unset env

Remove these from the API service (names only; values are not in git):

- `META_REVIEWER_ACCESS_ENABLED`
- `META_REVIEWER_LINK_SECRET_HASH`
- `META_REVIEWER_DROP_ID`
- `META_REVIEWER_ORG_EMAIL`

There is no migration to reverse.
