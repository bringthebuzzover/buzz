# BUZZ Lab

Private design directory at `lab.bringthebuzzover.com`. Cloudflare Pages serves a static build of `frontend/`. Cloudflare Access sits in front of it with email one-time-PIN login.

This is not the production site. Do not change the Railway service, its variables, or `main`. The Pages **production branch** for this project is `design/brainstorm`.

The app is Create React App via craco, not Vite. Ignore the Vite preset in the Pages dashboard (that preset expects `dist/`).

Checked against Cloudflare’s docs on 27 Oct 2026. Dashboard labels drift; the links below are the source for each step.

## What the lab build changes

`npm run build` is the production build. It does not read `VITE_LAB`, does not swap the webpack entry, and does not emit `robots.txt`, `_headers`, or `_redirects`.

`npm run build:lab` (`frontend/scripts/build-lab.mjs`) does four things:

1. Sets `VITE_LAB=1` and runs craco. `frontend/craco.config.js` then uses `src/lab/index.tsx` instead of `src/index.tsx`. `/` and `/lab` render the directory. Every other route is the normal app, with a fixed **Design preview** badge.
2. Copies `frontend/lab-static/drop-editor/` to `/lab/drop-editor/` and `design/logo-options/` to `/lab/logo-options/`.
3. Adds `<meta name="robots" content="noindex, nofollow">` to HTML, writes `robots.txt` (`Disallow: /`), and writes `_headers` with `X-Robots-Tag: noindex, nofollow`.
4. Writes `_redirects` so unknown paths fall through to the SPA. Real files win first, including the drop editor.

Pages only sends `X-Robots-Tag: noindex` on **preview** deployments. `design/brainstorm` is this project’s production branch, so `lab.bringthebuzzover.com` would be indexable without our own meta, `robots.txt`, and `_headers`.

## Cloudflare Pages project

Docs: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [headers](https://developers.cloudflare.com/pages/configuration/headers/), [redirects](https://developers.cloudflare.com/pages/configuration/redirects/).

1. Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Choose the GitHub repo `bringthebuzzover/buzz`. Authorize Pages for that repo if asked.
3. **Production branch:** `design/brainstorm`. Not `main`. Commits to `main` must not deploy this project. Other branches become preview deployments.
4. **Framework preset:** None.
5. **Root directory (advanced):** `frontend`. Pages still clones the whole repo; craco reads `../backend/brand_emails.json`, so the root has to be `frontend` and the parent file has to be in the clone.
6. **Build command:** `npm run build:lab`
7. **Build output directory:** `build`
8. **Environment variables**, for both **Production** and **Preview**:
   - `VITE_LAB` = `1`
   - `NODE_VERSION` = `22`
9. Save and deploy. Do not set `VITE_LAB` on Railway.

`VITE_LAB` on Preview means a later branch that contains this craco hook also builds as a lab (badge, noindex, directory). A branch that does not contain the hook ignores the variable.

Leave `REACT_APP_API_URL` unset. Plain `npm run build` does not require it, and the lab should not be a second client of the production API. Design routes in this directory do not call the API.

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

**1. Preview wildcard** (`<hash>.<project>.pages.dev` and branch aliases):

1. Pages project → **Settings** → **General** → **Enable access policy**.

That protects hash preview URLs only. It does not protect `<project>.pages.dev` or the custom domain.

**2. The project hostname** `<project>.pages.dev`, while keeping the wildcard:

Follow [Known issues → Enable Access on your `*.pages.dev` domain](https://developers.cloudflare.com/pages/platform/known-issues/). In short: open the Access application Pages just created, remove the `*` subdomain and save, then on the Pages project choose **Enable access policy** again. You should end with two applications: one for `<project>.pages.dev` and one for `*.<project>.pages.dev`.

**3. Custom domain:**

1. **Zero Trust** → **Access controls** → **Applications** → **Create new application** → **Self-hosted and private** → **Add public hostname**.
2. Domain: `bringthebuzzover.com`. Subdomain: `lab`.
3. Attach the `BUZZ Lab allow` policy.
4. Identity providers: **One-time PIN**. Leave instant authentication off so the Access login page asks for an email.
5. Session duration: 24 hours. Create.

Attach `BUZZ Lab allow` to the Pages-created applications as well, and select One-time PIN on those applications, so preview URLs use the same list.

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

Access keeps an existing login until the application session ends (24 hours above). Taking an email off the policy stops the next login. It does not cut a session that is already open.

- Guest who was listed under **Emails:** edit `BUZZ Lab allow` and delete that Include row.
- Person at `@bringthebuzzover.com`: the domain rule still matches them. Add a **Block** policy, Include → **Emails** → that address, and put the Block policy **above** Allow on every Lab application. Access stops at the first matching policy.
- To end it sooner than 24 hours, shorten the session duration on each application. There is no separate “revoke this OTP session now” switch. New logins follow the edited policy immediately.

Removing `@bringthebuzzover.com` from Include locks out the whole company, not one person.

## Local checks

From `frontend/`:

```bash
npx tsc --noEmit
CI=true npm test -- --watchAll=false
npm run build
npm run build:lab
```

`npm run build` must not contain `Design preview` in `build/static/js`, and must not contain `robots.txt`, `_headers`, or `_redirects`.

Serve the lab build from `frontend/build` with a static file server that leaves directory indexes alone (Python does; `npx serve -s` rewrites them to the SPA and hides the mockup):

```bash
python3 -m http.server 4173
```

Directory: `/` and the same page at `/lab` once the SPA is on Pages (`_redirects`). Drop editor: `/lab/drop-editor/`, plus `?mode=brand`, `?pop=1`, `?desc=1`, `?edit=1`. Logo sketches: `/lab/logo-options/`.

On Cloudflare, a request for a real file or a folder `index.html` is served as that file. `_redirects` runs only when nothing on disk matches, which is how `/pulse` and `/inspo` reach the SPA.
