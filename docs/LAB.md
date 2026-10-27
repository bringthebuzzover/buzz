# BUZZ Lab

Private design directory at `lab.bringthebuzzover.com`. Cloudflare Pages serves a static build of `frontend/`. The Lab's own BUZZ-branded email-code login (a Pages Functions middleware, see [Lab login](#lab-login)) gates every page. The Cloudflare Access setup below is the older gate; keep it only until the Lab login is verified end to end.

This is not the production site. Do not change the Railway service, its variables, or `main`. The Pages **production branch** for this project is `design/brainstorm`.

The app is Create React App via craco, not Vite. Ignore the Vite preset in the Pages dashboard (that preset expects `dist/`).

Checked against Cloudflare’s docs on 27 Oct 2026. Dashboard labels drift; the links below are the source for each step.

## What the lab build changes

`npm run build` is the production build. It does not read `VITE_LAB`, does not swap the webpack entry, and does not emit `robots.txt`, `_headers`, or `_redirects`.

`npm run build:lab` (`frontend/scripts/build-lab.mjs`) does five things:

1. Sets `VITE_LAB=1` and runs craco. `frontend/craco.config.js` then uses `src/lab/index.tsx` instead of `src/index.tsx`. `/` and `/lab` render the directory. Every other route is the normal app, with a fixed **Design preview** badge.
2. Copies `frontend/lab-static/drop-editor/` to `/lab/drop-editor/` and `design/logo-options/` to `/lab/logo-options/`, resolving symlinks to real files (Pages rejects links in the output, and `fs.cpSync`'s `dereference` is ignored on Node 22).
3. Adds `<meta name="robots" content="noindex, nofollow">` to HTML, writes `robots.txt` (`Disallow: /`), and writes `_headers` with `X-Robots-Tag: noindex, nofollow`.
4. Writes `_redirects` with two trailing-slash 301s, for `/lab/drop-editor` and `/lab/logo-options`. It does not write a `/* /index.html 200` splat, and it does not write a top-level `404.html`.
5. Removes `hero.mp4` and `hero-h264.mp4` from the output and adds `_redirects` 302s for them to the identical files on `https://www.bringthebuzzover.com`. Pages rejects files over 25 MiB. The build fails if any other file is over 25 MiB or any symlink is left.

Pages follows every line in `_redirects` whether or not a file matches ([redirects](https://developers.cloudflare.com/pages/configuration/redirects/)). A splat onto `/index.html` would serve the SPA shell for `robots.txt`, the JS bundles, and the drop-editor assets. Do not add one.

With no top-level `404.html`, Pages treats the project as a single-page app and serves `/index.html` only when the path is not a static asset ([Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/), updated 10 Oct 2026). That is how `/lab`, `/pulse`, `/pulse2`, and `/inspo` reach the app. A real file, including `robots.txt`, `static/js/main.*.js`, and `/lab/drop-editor/index.html`, is served as that file.

Pages only sends `X-Robots-Tag: noindex` on **preview** deployments. `design/brainstorm` is this project’s production branch, so `lab.bringthebuzzover.com` would be indexable without our own meta, `robots.txt`, and `_headers`.

## Cloudflare Pages project

Docs: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [headers](https://developers.cloudflare.com/pages/configuration/headers/), [redirects](https://developers.cloudflare.com/pages/configuration/redirects/).

1. Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Choose the GitHub repo `bringthebuzzover/buzz`. Authorize Pages for that repo if asked.
3. **Production branch:** `design/brainstorm`. Not `main`. After the project exists, open **Settings** → **Builds** → **Branch control** ([GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)). Confirm **Production branch** is `design/brainstorm`. Under **Preview branch**, exclude `main` (Custom branches). To build no other branches, set preview deployments to **None (Disable automatic branch deployments)**. Choosing `design/brainstorm` at create time does not stop Pages from previewing `main`.
4. **Framework preset:** None.
5. **Root directory (advanced):** `frontend`. Pages still clones the whole repo; craco reads `../backend/brand_emails.json`, so the root has to be `frontend` and the parent file has to be in the clone.
6. **Build command:** `npm run build:lab`
7. **Build output directory:** `build`
8. **Environment variables**, for both **Production** and **Preview**:
   - `VITE_LAB` = `1`
   - `NODE_VERSION` = `22`
9. Save and deploy. Do not set `VITE_LAB` on Railway.

`VITE_LAB` on Preview means a later branch that contains this craco hook also builds as a lab (badge, noindex, directory). A branch that does not contain the hook ignores the variable.

Leave `REACT_APP_API_URL` unset. Plain `npm run build` does not require it, and the lab should not be a second client of the production API. The lab entry does not mount `AuthProvider`, and the lab webpack build replaces `src/api/config.ts`, so the production “URL is unset” log does not run and the preview does not call `/refresh`. Design routes still render.

## Custom domain

Docs: [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/), [known issues](https://developers.cloudflare.com/pages/platform/known-issues/) (custom domains and Access).

Add the domain **before** putting Access on it. A hostname that already has an Access policy cannot be added as a Pages custom domain, and Access will block the certificate check on `http://lab.bringthebuzzover.com/.well-known/acme-challenge/` if it is in front too early.

1. Open the Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `lab.bringthebuzzover.com`. Continue and activate.
3. DNS for `bringthebuzzover.com` is already on Cloudflare. Accept the record Pages offers. This hostname is Pages, so the proxied CNAME Pages creates is the right one. Do not point `www` or `api` here; those belong to Railway.

Wait until the domain shows as active and the certificate is issued. Then open `https://lab.bringthebuzzover.com/` and confirm the directory, not the public marketing home.

## Access (one-time PIN)

Docs: [one-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/), [common policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/), [self-hosted public application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/), [preview access](https://developers.cloudflare.com/pages/configuration/preview-deployments/#customize-preview-deployments-access), [known issues — Access on `*.pages.dev`](https://developers.cloudflare.com/pages/platform/known-issues/).

One Access application cannot cover both the custom domain and `pages.dev`. Pages owns the `pages.dev` hostnames; the custom domain needs its own application. Preview URLs are public until you turn a policy on.

### One-time PIN identity provider

1. **Zero Trust** → **Integrations** → **Identity providers** → **Add new identity provider** → **One-time PIN**.

New Zero Trust orgs do not add OTP automatically.

### Allow policy

1. **Zero Trust** → **Access controls** → **Policies** → **Add a policy**.
2. Name: `BUZZ Lab allow`. Action: **Allow**. Session duration: 24 hours.
3. **Include** rules (a user may match any one of them):
   - **Emails ending in** → `@bringthebuzzover.com`
   - **Emails** → one row per guest who is not on that domain. Use the real address in the dashboard only. Do not commit it. Example placeholder: `guest@example.com`.
4. **Require** → **Login methods** → **One-time PIN**.

Include without an email domain or an email list lets anyone request a PIN. Keep the Include rules. Do not add “everyone”.

### Hostnames to protect

Cover all three. A branch alias such as `fix-api.<project>.pages.dev` is a preview hostname. If only the custom domain is locked, that alias is public.

**1. Preview wildcard** (`*.<project>.pages.dev`):

This hostname covers hash previews (`<hash>.<project>.pages.dev`) and branch aliases (`fix-api.<project>.pages.dev`). It does not cover `<project>.pages.dev` or `lab.bringthebuzzover.com`.

1. Pages project → **Settings** → **General** → **Enable access policy**.

That creates an Access application for the wildcard and an Allow policy for Cloudflare account members. A member who is not on the email list would still get in, and one-time PIN would not be the only login method. On that application, remove the generated allow policy. Attach only `BUZZ Lab allow`, and select **One-time PIN**.

**2. The project hostname** `<project>.pages.dev`, while keeping the wildcard:

Follow [Known issues → Enable Access on your `*.pages.dev` domain](https://developers.cloudflare.com/pages/platform/known-issues/). In short:

1. Open the Access application Pages just created → **Configure**.
2. Change the **Application name** before saving. Save can fail while the name still belongs to the wildcard application.
3. Under **Public hostname**, delete the `*` subdomain and **Save**.
4. On the Pages project, **Settings** → **General** → **Enable access policy** again.

You should end with two applications: one for `<project>.pages.dev` and one for `*.<project>.pages.dev`. On the new application, remove the generated account-members allow policy and attach only `BUZZ Lab allow` with **One-time PIN** selected.

**3. Custom domain:**

1. **Zero Trust** → **Access controls** → **Applications** → **Create new application** → **Self-hosted and private** → **Add public hostname**.
2. Domain: `bringthebuzzover.com`. Subdomain: `lab`.
3. Attach only the `BUZZ Lab allow` policy.
4. Identity providers: **One-time PIN**. Leave instant authentication off so the Access login page asks for an email.
5. Session duration: 24 hours. Create.

Confirm:

- `https://lab.bringthebuzzover.com/` asks for an email, then a code.
- `https://<project>.pages.dev/` asks too.
- A fresh preview URL asks too.
- An address that is not on the list sees the login page say a code was sent, and no code arrives. That is how OTP works.

## Branch previews

Docs: [preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/) (including [preview aliases](https://developers.cloudflare.com/pages/configuration/preview-deployments/#preview-aliases)).

Every branch Pages builds gets:

- a hash URL, stable for that deployment, shaped `<hash>.<project>.pages.dev`
- a branch alias that always tracks the latest commit on that branch

The alias is the branch name, lowercased, with each run of non-alphanumeric characters replaced by a hyphen. `fix/api` becomes `fix-api.<project>.pages.dev`.

`/pulse` and `/pulse2` are on `design/brainstorm` (squash-merged from [PR 20](https://github.com/bringthebuzzover/buzz/pull/20) as `40ee864`). Their cards link to `/pulse` and `/pulse2` on the lab host.

When a design exists only on another branch, set `branch` (and optional `branchPath`) on its directory entry. The card then links that branch alias as well as the in-app path. `LAB_PAGES_PROJECT` in `frontend/src/data/labEntries.ts` is the label before `.pages.dev`; it stays `{project}` until the Pages project has a name.

Pages will not build pull requests that come from a fork. Preview URLs update when the branch is pushed inside this repo. Access has to cover `*.<project>.pages.dev`, or those aliases are public.

## Add a directory entry

Edit `frontend/src/data/labEntries.ts` and append one object to `labEntries`:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Unique slug |
| `name` | yes | Card title |
| `note` | yes | One line |
| `status` | yes | `Live`, `Frozen`, `Idea`, or `Mockup` |
| `href` | yes | Path on the lab host (`/inspo`, `/lab/...`) |
| `thumbnail` | yes | Imported image under `frontend/src/lab/media/` |
| `thumbnailAlt` | yes | What the picture shows |
| `prUrl` | no | GitHub pull request |
| `branch` | no | Branch that has the route when `design/brainstorm` does not |
| `branchPath` | no | Path on that preview; defaults to `href` |
| `quickLinks` | no | Extra links, as on the drop editor |
| `thumbnailFit` | no | `"contain"` for a mark on a plain field |

Put a new static mockup in `frontend/lab-static/<name>/` (an `index.html` plus its assets, relative URLs). `build:lab` copies that folder to `/lab/<name>/` and adds the badge and `noindex`. A React route that already exists only needs the object.

Open a pull request into `design/brainstorm`. Pages rebuilds the production branch when it merges. Do not merge to `main` for a lab-only change.

## Revoke someone

Taking an email off `BUZZ Lab allow` stops the next login. It does not end a session that is already open. Docs: [session management](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/#revoke-user-sessions).

- Every open session for one application: **Zero Trust** → **Access controls** → **Applications** → that application → **Configure** → **Revoke existing tokens**. Do this on the wildcard, the project hostname, and the custom domain.
- One person, across applications: **Zero Trust** → **Team & Resources** → **Users** → select them → **Action** → **Revoke**.
- Guest listed under **Emails:** also delete that Include row, or they can sign in again.
- Person at `@bringthebuzzover.com`: the domain rule still matches them, so a revoke does not keep them out. Add a **Block** policy, Include → **Emails** → that address, and put the Block policy **above** Allow on every Lab application. Access stops at the first matching policy.

Removing `@bringthebuzzover.com` from Include locks out the whole company, not one person.

## Lab login

A BUZZ-branded email + 6-digit code login, built into the Lab so it does not use the Cloudflare account's shared Access login page.

Code: `frontend/functions/_middleware.js` (Pages deploys `functions/` from the project root, `frontend`) re-exports `frontend/lab-auth/handler.mjs`. Assets for the login page (Switzer, the BUZZ logo, the bee) are copied to `build/__lab/assets/` by `scripts/copy-lab-login-assets.mjs`, which `npm run build:lab` runs last.

### Environment variables (Pages → lab-buzz → Settings → Variables and Secrets)

Set on **Production** (and **Preview** too if branch previews should be reachable; without them previews fail closed, see below). Use **Secret** (encrypted) for the last two.

| Name | Value | Notes |
| --- | --- | --- |
| `LAB_AUTH` | `1` | Turns the gate on. Unset, `0` or `false`: the middleware does nothing. Any other value fails closed. |
| `LAB_ALLOWED_EMAILS` | `hello@bringthebuzzover.com` | Comma-separated, case-insensitive. Only these get a code. Removing an address also ends its open sessions. |
| `LAB_SESSION_SECRET` | 32+ random characters (`openssl rand -base64 48`) | Signs session and code cookies. Rotating it signs everyone out. |
| `RESEND_API_KEY` | a send-only Resend key for `bringthebuzzover.com` | Sends the code email. |
| `LAB_EMAIL_FROM` | optional | Defaults to `BUZZ Lab <lab@bringthebuzzover.com>`. Must be on the verified Resend domain `bringthebuzzover.com`. |
| `LAB_DEV_LOG_CODE` | never set in Pages | Local testing only: logs the code instead of emailing it, and only for requests to `localhost` / `127.0.0.1`. |

Variables apply on the next deploy. Re-run the latest production deploy after changing them.

### How it works

- With `LAB_AUTH=1`, every request needs a valid `lab_session` cookie except `/__lab/login`, `/__lab/verify`, `/__lab/logout`, `/__lab/assets/*` and `/robots.txt`. Signed-out `GET`s redirect to `/__lab/login?next=<path>`; other methods get 401.
- `LAB_AUTH=1` with a missing or short secret, an empty allowlist or no Resend key: every path, login included, returns a 503 "Lab is locked" page naming the missing variables (never their values).
- The code is 6 random digits, valid 10 minutes, 5 tries. It is never stored: the `lab_challenge` cookie (Path `/__lab`) holds an HMAC of it, signed with `LAB_SESSION_SECRET`. A used or exhausted challenge is refused.
- Any other email gets the same "if this address is allowed, a code is on its way" screen and a decoy challenge no code can satisfy. No email is sent.
- Session: `lab_session`, HMAC-signed, `HttpOnly; Secure; SameSite=Lax`, 24 hours. `/__lab/logout` clears it.
- Limits (best effort, per Cloudflare location, via the Workers Cache API): 10 code requests per IP and 3 per email per 10 minutes; 30 code checks per IP per 10 minutes; the per-code attempt count is kept server-side as well as in the cookie. For a hard global limit, add a WAF rate-limiting rule on `lab.bringthebuzzover.com/__lab/*`.
- Login pages send `X-Robots-Tag: noindex`, `Cache-Control: no-store`, a no-script CSP, and refuse cross-origin POSTs. Every gated response also gets `X-Robots-Tag: noindex`.

Production is unaffected: Railway serves `frontend/build` from `npm run build`, which neither includes nor runs `functions/`, and `LAB_AUTH` is never set there.

### Test locally

From `frontend/`:

```bash
npm run test:lab-auth
npm run build:lab
npx wrangler pages dev build \
  --binding LAB_AUTH=1 \
  --binding LAB_ALLOWED_EMAILS=hello@bringthebuzzover.com \
  --binding LAB_SESSION_SECRET=local-dev-only-secret-0123456789abcdef \
  --binding RESEND_API_KEY=re_fake_local \
  --binding LAB_DEV_LOG_CODE=1
```

Open `http://localhost:8788/`, enter the allowed email, and read the code from the wrangler log line `[lab-auth] dev code for …`.

### Revoke someone (Lab login)

Remove the address from `LAB_ALLOWED_EMAILS` and redeploy; their session stops working on the next request. To sign everyone out, rotate `LAB_SESSION_SECRET` and redeploy.

## Local checks

From `frontend/`:

```bash
npx tsc --noEmit
CI=true npm test -- --watchAll=false
npm run build
npm run build:lab
```

`npm run build` must not contain `Design preview` in `build/static/js`, and must not contain `robots.txt`, `_headers`, or `_redirects`.

Check the lab output the way Pages serves it, from `frontend/`:

```bash
npx wrangler pages dev build
```

`/robots.txt` is `Disallow: /`. `/static/js/main.*.js` is the script. `/lab/drop-editor/` is the mockup, and a file under `/lab/drop-editor/a/` is the image, not the SPA shell. `/pulse` and `/inspo` fall back to `index.html` because there is no top-level `404.html`.

`python3 -m http.server` serves real files and directory indexes. It does not apply that SPA fallback, so `/pulse` and `/lab` 404 there. `npx serve -s` rewrites directory indexes to the SPA and hides the mockup.
