---
id: deploy.meta-app-review
title: "Meta App Review (Instagram Login) — resubmission in progress"
kind: ops
severity: P0
status: in_progress
surface: deploy
evidence:
  - path: META.md
    note: §E–F and the 2026-08-31 “app is live” line lagged the 2026-10-26 dashboard (Development; BV Verified; App Review rejected)
  - path: backend/app/config.py
    note: INSTAGRAM_SCOPES is only instagram_business_basic and instagram_business_manage_insights
  - path: backend/app/services/instagram.py
    note: exchange_for_long_lived uses the documented GET graph.instagram.com/access_token; do not switch that call to POST
  - path: backend/app/services/instagram.py
    note: Business Discovery / graph.facebook.com removed (checklist 1c). Org login stays graph.instagram.com
  - path: frontend/src/utils/instagramCallbackCopy.ts
    note: API UNAUTHORIZED maps to "Instagram didn't connect" / didn't hand Buzz a session
  - path: frontend/src/pages/org/OrgCampaignDetailPage.tsx
    note: org campaign label is Instagram Reach on main (PR #7); the rejected insights screencast showed Est. Reach
  - path: gaps/archive/ops.ig-business-discovery-unset.md
    note: Facebook Login lookup removed 2026-10-26; the service token was never set
repro: |
  Read-only Meta dashboard check, 2026-10-26 (do not paste tokens or tester
  credentials into git or chat). Facebook app BUZZ 1589568552810678 and
  Instagram app BUZZ - IG 2056969808271074. App mode Development. Standard
  Access. App Review for instagram_business_basic and
  instagram_business_manage_insights submitted 2026-10-07, rejected under
  Developer Policy 1.6.
  Instagram Testers: 3 accepted, 11 pending. The 11 pending invites are
  blocked the same way as non-testers. Handles are not listed.
  After 1f389a9, org Connect on www.bringthebuzzover.com.
  SPA GET /auth/instagram/callback 200; POST /api/auth/instagram/callback 401
  "Instagram long-lived token exchange failed."
  API log 2026-09-17 20:32–20:34Z:
  status=400 type=IGApiException message=Unsupported request - method type: get code=100
  Code requests only instagram_business_basic and
  instagram_business_manage_insights (INSTAGRAM_SCOPES in
  backend/app/config.py).
fix_when: |
  Advanced Access is approved for instagram_business_basic and
  instagram_business_manage_insights, and the app is in Live mode. A
  non-tester Instagram Business or Creator account then completes Connect on
  https://www.bringthebuzzover.com through the documented GET
  graph.instagram.com/access_token exchange (META.md §G).
  An accepted Instagram Tester must also complete that same GET. If Graph 100
  persists for a tester (IGApiException code 100, "Unsupported request -
  method type: get"), reopen a code gap. Do not switch
  exchange_for_long_lived to POST; Access Token docs mark Creating as
  unsupported.
  The resubmission’s screencasts and usage text must match the code: consent
  under the app name BUZZ - IG, both permissions listed, org campaign label
  Instagram Reach, and the feed/reel metrics in instagram.py. Reviewers use
  the test-credentials field (accepted tester + a Buzz test org), not their
  own account.
  All other permissions and features were removed on 2026-10-27 (reversible).
  Business Verification is already Verified (2026-10-26) and is not the
  remaining gate. Do not archive on submit alone.
  Do not commit tester passwords, access tokens, or one-time connect links.
---

# Meta App Review (Instagram Login) — resubmission in progress

Retired ids: `deploy.meta-business-verification`, `auth.ig-long-lived-get-unsupported`.
Both are pointers in [`gaps/archive/`](archive/). This file is the living gap.

Business Verification is **Verified**. Public org login is still blocked on
**App Review**. Meta rejected the 2026-10-07 submission for
`instagram_business_basic` and `instagram_business_manage_insights`
(Developer Policy 1.6 — reviewers could not verify the use case / login
flow). That rejection matches the screencasts and the form text. The same
gate is why non-testers, and the **11 pending** tester invites, get Graph
**100** on the long-lived token exchange. Approval (Advanced Access) plus
**Live** mode is the fix. This file is that workstream.

Human Meta dashboard only. Agents verify; do not mutate Meta, submit App
Review, or paste tester credentials without an explicit OK.
[`LAUNCH.md`](../LAUNCH.md) still treats Advanced Access as outside the
seeded revamp: accepted testers can log in without it. Seeded onboarding
stays “add the handle as an Instagram Tester, then Connect.”

## Verified 2026-10-26 (dashboard, read-only)

### Apps

| | |
| --- | --- |
| Facebook app | **BUZZ** `1589568552810678` |
| Instagram app | **BUZZ - IG** `2056969808271074` |
| App mode | **Development** |
| Business Verification | **Verified** |
| Required actions | None |
| Webhooks | Off |

Earlier notes that called BUZZ **Live** (META.md status 2026-08-31,
archived `ops.ig-business-discovery-unset`) do not match this check.

### Settings that are in place

| Setting | Value |
| --- | --- |
| Privacy policy | `https://www.bringthebuzzover.com/privacy` |
| Terms | `https://www.bringthebuzzover.com/terms` |
| Data deletion instructions | `https://www.bringthebuzzover.com/data-deletion` |
| App icon | Present |
| OAuth redirect | `https://www.bringthebuzzover.com/auth/instagram/callback` |
| Deauthorize callback | `https://api.bringthebuzzover.com/api/auth/instagram/deauthorize` |

Advanced settings shows a notice recommending a **Data Deletion Callback
URL**. Only the instructions URL is set. Lawrence skipped the callback on
2026-10-27 (checklist 2b). It is not required.

### Instagram Testers

**3 accepted, 11 pending.** The 11 pending invites are blocked. Only an
accepted tester can complete Instagram Login while the app stays in
Development on Standard Access. A pending invite fails the same way as a
non-tester: Graph 100 on the long-lived exchange (below). Handles are not
listed here.

### Permissions

Rechecked **2026-10-27**. Both are Active and **App Review rejected**, pending resubmission. Last 30 days: `instagram_business_basic` 968 calls, `instagram_business_manage_insights` 291.

Requested via `INSTAGRAM_SCOPES` in `backend/app/config.py`.

| Permission | Why we need it | Where in code |
| --- | --- | --- |
| `instagram_business_basic` | Identify the connected org account (`id` or `user_id`, `username`, `account_type`, `followers_count`). List its media (`id`, `timestamp`). For linked posts, read `like_count`, `comments_count`, `caption`, `media_type`, `media_product_type`, `permalink`, `thumbnail_url`, `media_url`, `timestamp`. Shown on the org profile and campaign. | `fetch_profile`, `fetch_user_media`, `fetch_media` in `backend/app/services/instagram.py` |
| `instagram_business_manage_insights` | Post insights for linked posts. Feed: `reach`, `views`, `saved`, `shares`, `total_interactions`, `profile_visits`, `profile_activity`, `follows`. Reels: `reach`, `views`, `saved`, `shares`, `total_interactions`, `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`, `reels_skip_rate`. Each Instagram post on the org campaign Linked posts card and the brand drop posts list shows an Instagram insights row for the metrics requested for that media type (admin View as uses those pages). Summed reach still appears as Instagram Reach / Total reach. A missing value is an em dash. | `_FEED_INSIGHT_METRICS` and `_REEL_INSIGHT_METRICS` in `instagram.py` (`fetch_media_insights`) |

`public_profile` is a Meta default. It can't be removed, has 0 calls, and is not requested.

All other permissions and features were removed on 2026-10-27 (reversible).

There are no `graph.facebook.com` calls.

### Submission

Submitted **2026-10-07** for `instagram_business_basic` and
`instagram_business_manage_insights`. **Rejected** (Developer Policy 1.6).
The export reproduced in the appendix was downloaded 2026-10-26, 9:34 AM PDT.
The one-time connect token in that export is `[REDACTED]`.

## Graph 100 on the documented long-lived GET

Short-lived code exchange is fixed (`auth.ig-token-exchange-data-wrap`,
archived). The next hop is
[Access Token](https://developers.facebook.com/docs/instagram-platform/reference/access_token/)
(updated 2026-03-09):

- **Reading:** `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=…&access_token=…`
- **Creating / Updating / Deleting:** not supported (do not POST)

`exchange_for_long_lived` in `backend/app/services/instagram.py` uses that
GET. Production returns Graph **400** `IGApiException` **100** “Unsupported
request - method type: get” for an Instagram account that is not an accepted
[Instagram Tester](https://developers.facebook.com/docs/development/build-and-test/app-roles/).
Testers can GET. Non-testers and the **11 pending** invites get this 100.
The SPA shows it as `UNAUTHORIZED` (“Instagram didn't connect”) in
`frontend/src/utils/instagramCallbackCopy.ts`.

Community threads that “fixed” the 100 with POST are fighting the same
access gate. Official CRUD still forbids Creating on this node. If an
**accepted** tester still gets Graph 100, reopen a **code** gap. Do not
switch this call to POST.

Chrome AutoClicker / LMS / `Receiving end does not exist` lines are extensions.

## Why the rejection was justified

Reviewed against the submitted videos and the form text.

**Video A** (`instagram_business_basic`, about 2:43) spends about two
minutes on signup, email verification, and admin approval. Instagram login
skips the credentials screen and shows only a re-auth “continue sharing”
screen. That screen says the account was already connected to **BUZZ-IG**
and lists no permissions. Profile data is on screen only briefly.

**Video B** (`instagram_business_manage_insights`, about 1:14) has no
login, no consent screen, and no captions. The metric label on screen is
**Est. Reach**. On `main`, that label is **Instagram Reach**
([PR #7](https://github.com/bringthebuzzover/buzz/pull/7), merged).

Reviewer instructions tell the reviewer to use **their own** Instagram
Business or Creator account, and in the same text admit that Development
mode blocks anyone who is not an accepted tester. The optional
test-credentials field was blank, so the reviewer had no account that could
finish the flow.

The written answers contradict the product:

| Form said | Code does |
| --- | --- |
| “Buzz does not use Facebook Login.” | Accurate after checklist 1c. The Business Discovery call on `graph.facebook.com` was removed. Org Connect uses Instagram Login only (`graph.instagram.com`). |
| “There is no access to messages or comments.” | Usage text also says Buzz reads **likes and comments** on linked posts. Those are counts on media (`like_count`, `comments_count`), not comment management or messaging. |
| Insights are “reach and related insights.” | Feed metrics are `reach`, `views`, `saved`, `shares`, `total_interactions`, `profile_visits`, `profile_activity`, `follows`. Reel metrics add `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`, and `reels_skip_rate` (`instagram.py` `_FEED_INSIGHT_METRICS` / `_REEL_INSIGHT_METRICS`). |
| Consent was a re-auth for **BUZZ-IG**, with no permission list | A new recording must show a first grant. The Instagram app name on the dashboard is **BUZZ - IG**. Hold that screen until the name and both permissions are readable. |

## Resubmission checklist

Do the steps in order. Recording and form text depended on the dashboard
cleanup and the Facebook Login decision; both are done (checklist 1c and
2a). Do not put tester passwords, session cookies, or one-time connect
links in this repo.

| # | Work | Owner | Status |
| --- | --- | --- | --- |
| 1a | Rename **Est. Reach** → **Instagram Reach** on the org campaign | Engineering | **Done.** [PR #7](https://github.com/bringthebuzzover/buzz/pull/7) merged. Record from a www build that serves this label. |
| 1b | Pin Graph `v26.0` on Instagram reads and store granted permissions per login | Engineering | **Done.** [PR #8](https://github.com/bringthebuzzover/buzz/pull/8) merged as `12f8850`. |
| 1c | Decide: remove the unused Facebook Login Business Discovery path, or disclose it on the form | Lawrence + engineering | **Done.** Path removed in [`8266712`](https://github.com/bringthebuzzover/buzz/pull/15). Apply is a typed handle, stored unconfirmed. |
| 2a | Remove unused permissions and features | Lawrence | **Done (2026-10-27).** Only the two permissions above remain. |
| 2b | Consider a Data Deletion Callback URL (instructions URL already set) | Lawrence | **Skipped (Lawrence, 2026-10-27).** Data deletion instructions URL is set; callback not required. |
| 3 | Put an **accepted** tester’s Instagram credentials and a Buzz test org in the test-credentials field. Do not tell reviewers to use their own account. | Lawrence | **Not started.** Credentials stay in the Meta form, not in git. |
| 4 | Record two captioned videos (English). Each file contains its own login, grant, and that permission’s data. See the recording bar below. | Lawrence | **Not started.** Confirm Instagram Reach shows on www while recording. 1c and 2a are done. |
| 5 | Rewrite each permission’s usage description. Name the fields and metrics. Say “comment counts,” not that Buzz has no access to comments. Say only these two permissions are requested. | Engineering drafts; Lawrence confirms | **Not started.** |
| 6 | Submit | Lawrence | **Not started.** |

**Recording bar.** Use an accepted tester whose Instagram account is not
already authorized for Buzz (remove the app first, or use an account that
has never approved it). A first bind starts on the connect page and uses
**Connect with Instagram**, not **Continue with Instagram** on `/login`.
Continue with Instagram is only the returning path, and only after that
account is already the org’s login.

Record two files. Do not cut one session so that either file loses the
login. Each file, in English, with captions, must show:

1. Instagram credentials, if Instagram asks.
2. A first-time consent screen for **BUZZ - IG** that lists the permission
   this video is for. Hold it until the app name and the permission are
   readable. Click Allow.
3. Back in Buzz, data from the account that just clicked Allow. The basic
   video shows that account’s `@username`, follower count, and a linked
   post’s like and comment counts. The insights video shows **Instagram
   Reach** on that same post, on the org campaign and the brand drop.

## Verify (read-only)

```text
Dashboard → both apps above → App mode = Development
Settings → Basic → Verification = Verified
App Review → instagram_business_basic and instagram_business_manage_insights
  = rejected until the new submission is approved
Instagram Testers → accepted count is what can log in
```

After Lawrence submits, re-check App Review status before claiming §F done.
§G (non-tester login on www) is still required to archive.

## Docs left on the old story

Not edited here. It still disagrees with this file:

- [`ideas/org-bind-at-signup.md`](../ideas/org-bind-at-signup.md) still cites
  `business_verification_passes: false` (2026-09-14). The link to this gap
  is updated; that 2026-09-14 sentence is not. Ideas are not SOT.

## Related

- [`META.md`](../META.md) — dashboard guide; §E done; §F is this resubmission.
- [`archive/ops.ig-business-discovery-unset`](archive/ops.ig-business-discovery-unset.md) — path removed (checklist 1c). Delete leftover Railway vars if present.
- [`archive/auth.ig-long-lived-get-unsupported.md`](archive/auth.ig-long-lived-get-unsupported.md) — absorbed id.
- [`archive/deploy.meta-business-verification.md`](archive/deploy.meta-business-verification.md) — renamed id.

## Appendix: Submitted form — full questions and our answers (2026-10-07)

Source: Meta “App review request for BUZZ (app ID 1589568552810678)”,
downloaded October 26, 2026, 9:34 AM PDT. Question labels and answers are
the export. Hard line wraps are joined. The connect token was already
`[REDACTED]` in the export; no email addresses were in it. Three labels
are missing a space after a period in the export (`payment.Codes`,
`submission.Include`, `locations.For`) and are copied that way. The TCPDF
footer is omitted.

### 1. `instagram_business_basic` — how the permission is used

**Question**

```text
[instagram_business_basic] Tell us how you're using this permission or feature
```

**Submitted answer**

```text
Buzz connects campus organizations with brand campaigns. An organization connects its own Instagram professional account through Instagram Login. We use instagram_business_basic to read that account's username and profile, and to read the media on that account, including likes and comments on posts the organization links to a campaign. Those metrics are shown to the organization and to the brand on that campaign. We do not publish, comment, or message, and we do not read any Instagram account the organization did not connect. This permission is not requested as a dependency of messages or comments. INSTRUCTIONS Organizations do not have a Buzz password. We prepared a test organization named "Meta Test Org". It is already approved and waiting to connect Instagram. The attached video shows that setup: the application, email verification, Buzz approval, and the approval email. Your step is the Instagram connection at the end of that email. Use a desktop browser. Open this link once, in one window, and do not forward it or open it again: https://www.bringthebuzzover.com/onboarding/connect-instagram?token=[REDACTED] The page should say Connect Instagram. Click Connect with Instagram. Sign in with your own Instagram Business or Creator account, not a personal account. Approve the request. Buzz asks to read that account’s profile and insights only. There is no access to messages or comments. When Buzz opens again, go to https://www.bringthebuzzover.com/org/profile (or choose Profile in the top navigation; on a narrow window, open the menu first). Instagram identity is the @username you just connected. Instagram followers is the count from that account. This Meta app is still in Development, so Instagram only lets accepted Testers through. If Instagram stops you before you return to Buzz, do not try another login. Reply with the Instagram @username and a screenshot of Instagram’s message, then wait. We will add that username as an Instagram Tester and send a new link. Accept the invite at https://www.instagram.com/accounts/manage_access/ under Tester Invites (the invite is from BUZZ), then open only the new link. If Buzz shows an error, copy the heading and the sentence under it and send them to us. We are not requesting messages or comments.
```

**Resubmission change.** Drop the signup walkthrough and the one-time
connect link. Describe profile fields and media Buzz actually reads, and
call likes/comments **counts**. Delete “no access to comments.” Do not tell
the reviewer to use their own account or to wait while we add them as a
tester. Point at the credentials in field 15 and at `/login`.

### 2. `instagram_business_basic` — video

**Question**

```text
[instagram_business_basic] Provide a detailed step-by-step video walkthrough of how your app will use this permission or feature so we can confirm it is used correctly and does not violate our policies.
```

**Submitted answer**

```text
video
```

**Resubmission change.** Replace Video A. New captioned video: credentials,
full consent under **BUZZ - IG** listing this permission, then profile data
held on screen long enough to read. No two-minute signup preamble. No
“already connected to BUZZ-IG” re-auth screen. The file includes its own
login and Allow.

### 3. `instagram_business_basic` — allowed-usage attestation

**Question**

```text
[instagram_business_basic] The instagram_business_basic allows your app to read an Instagram Business account profile's info and media. The allowed usage for this permission is to get basic metadata of an Instagram Business account profile, for example username and ID. You may also use this permission to request analytics insights to improve your app and for marketing or advertising purposes, through the use of aggregated and de-identified or anonymized information (provided such data cannot be re-identified).

If approved, I agree that any data I receive through instagram_business_basic will be used in accordance with the allowed usage.
```

**Submitted answer.** The export has no separate written answer. Submitting
required agreeing to this block.

**Resubmission change.** Agree again on the new submission. No wording
change; this text is Meta’s.

### 4. `instagram_business_manage_insights` — how the permission is used

**Question**

```text
[instagram_business_manage_insights] Tell us how you're using this permission or feature
```

**Submitted answer**

```text
Buzz connects campus organizations to brand campaigns. Each organization logs in with Instagram and grants Buzz read access to its own professional account. We use instagram_business_basic to identify the account and read its media, including likes and comments on posts linked to a campaign. We use instagram_business_manage_insights to read reach and related insights for those same posts and show them to the organization and the brand. We do not publish content, read messages, or access any account the organization did not connect.
```

**Resubmission change.** Replace “reach and related insights” with the feed
and reel metric names in the table above. Say those metrics are shown on
each linked post’s **Instagram insights** row (org campaign and brand drop),
and that the campaign total is labeled **Instagram Reach**. Keep
likes/comments as counts. Say only these two permissions are requested.

### 5. `instagram_business_manage_insights` — video

**Question**

```text
[instagram_business_manage_insights] Provide a detailed step-by-step video walkthrough of how your app will use this permission or feature so we can confirm it is used correctly and does not violate our policies.
```

**Submitted answer**

```text
video
```

**Resubmission change.** Replace Video B. This file has its own login, its
own Allow on a consent screen that lists
`instagram_business_manage_insights` under **BUZZ - IG**, then a live
campaign. Hold on the org Linked posts card so **Instagram insights**
(reach, views, saves, shares, and the other metrics for that post type) is
readable, and show the same row on the brand drop. The **Instagram Reach**
total can stay in frame. English captions. Do not use a clip that starts
after login.

### 6. `instagram_business_manage_insights` — allowed-usage attestation

**Question**

```text
[instagram_business_manage_insights] The instagram_business_manage_insights permission allows an app to get insights from the app user's Instagram professional account metadata, posts, photos, and videos; and insights for an Instagram professional account's public profile metadata and media. The allowed usage of this permission is to allow an app to get the insights for the app user's Instagram professional account metadata, posts, photos, and videos; and get insights for an Instagram professional account's public profile metadata and media on behalf of the app user's Instagram professional account. You may also use this permission to request analytics insights to improve your app and for marketing or advertising purposes, through the use of aggregated and de-identified or anonymized information (provided such data cannot be re-identified).

If approved, I agree that any data I receive through instagram_business_manage_insights will be used in accordance with the allowed usage.
```

**Submitted answer.** The export has no separate written answer. Submitting
required agreeing to this block.

**Resubmission change.** Agree again. No wording change; this text is Meta’s.

### 7. `processor-0` — any processors

**Question**

```text
processor-0. Do you have data processors or service providers, including your own companies, that will have access to the Platform Data that you obtain from Meta? Data processors or service providers are separate entities that, on your behalf, process the Platform Data made accessible to you in order to provide you with a service. Please provide the names of any processors that will have access to the Platform Data made accessible to you through the requested permissions and features. “Platform Data” is any data that you receive from Meta (e.g., Meta user ID, email address, profile picture, Meta API user access token, and app secret).
```

**Submitted answer**

```text
Yes
```

**Resubmission change.** Reconfirm. No change unless a new processor will
see Platform Data. Do not paste an app secret into the answer.

### 8. `processor-2` — which processors

**Question**

```text
processor-2. List all data processors or service providers, including your own companies, that will have access to the Platform Data that you obtain from Meta. Please note that Platform Data may include a subset of personal data or personal information that relates to an identified or identifiable person.
```

**Submitted answer**

```text
Railway
```

**Resubmission change.** Reconfirm Railway is still the only processor of
Platform Data. Lawrence confirms before submit.

### 9. `processor-1a` — service category

**Question**

```text
processor-1a. For which category of services will this data processor process the personal data of users received from Meta? Select all that apply.
```

**Submitted answer**

```text
IT solutions and services, including cloud storage and processing
```

**Resubmission change.** No change. Reconfirm the same category for Railway.

### 10. `processor-1b` — countries

**Question**

```text
processor-1b. List all countries where this data processor will process the personal data of users received from Meta. Include locations from which the data processor will access the data remotely, via the internet. Select all that apply. Many data processors provide this information on their corporate website.
```

**Submitted answer**

```text
United States of America
```

**Resubmission change.** No change unless Railway’s processing locations for
this data have changed. Lawrence confirms.

### 11. `responsible-1` — who controls Platform Data

**Question**

```text
responsible-1. Who is the person or entity that will be responsible for all Platform Data Meta shares with you? Please provide the name of the legal entity that will control the data (i.e., determine the purposes and means of processing the data) made available to you by Meta through the requested permissions and/or features. This could be a natural or legal person, a public authority, an agency or other entity. In some regions this is called a data controller.
```

**Submitted answer**

```text
Bring the Buzz Over Inc.
```

**Resubmission change.** No change. Lawrence confirms the legal name is
still correct.

### 12. `responsible-2` — country of that entity

**Question**

```text
responsible-2. Select the country where this person or entity is located.
```

**Submitted answer**

```text
United States of America
```

**Resubmission change.** No change.

### 13. `requests-3` — national security requests

**Question**

```text
requests-3. Have you provided the personal data or personal information of users to public authorities in response to national security requests in the past 12 months? This does not include requests related to search warrants or court orders associated with criminal investigations. Personal data or personal information is any data you receive from Meta that relates to an identified or identifiable person.
```

**Submitted answer**

```text
No
```

**Resubmission change.** Lawrence reconfirms for the new 12-month window.
Do not change the answer in git if the fact changes; he answers on the form.

### 14. `requests-4` — policies for authority requests

**Question**

```text
requests-4. Which of the following policies or processes do you have in place regarding requests from public authorities for the personal data or personal information of users? Check all that apply.
```

**Submitted answer**

```text
None of the above.
```

**Resubmission change.** No change unless counsel has adopted one of Meta’s
listed policies since 2026-10-07. Lawrence confirms.

### 15. Web reviewer instructions

**Question**

```text
Provide instructions for accessing the app so we may complete our review. Explain how to navigate to the app, and provide instructions for testing.
```

**Submitted answer**

```text
Buzz does not use Facebook Login. Student organizations have no Buzz password. They sign in with Instagram Login using a Business or Creator account. We do not request Facebook user permissions such as email, public profile, user_friends, user_gender, or user_birthday. To review, use a desktop browser and open this link once, in one window. Do not forward it or open it again: https://www.bringthebuzzover.com/onboarding/connect-instagram?token=[REDACTED] The page says Connect Instagram. Click Connect with Instagram and approve access with your own Instagram Business or Creator account. Buzz reads that account’s profile and post insights only. There is no access to messages or comments. No payment or membership is required. When Buzz opens again, go to https://www.bringthebuzzover.com/org/profile. Instagram identity shows the @username you connected. Instagram followers shows the count from that account. The app is in Development mode, so only an accepted Instagram Tester can finish the consent screen. If Instagram blocks the account, reply with the @username. We will add it as an Instagram Tester and send a new link. Accept the invite at https://www.instagram.com/accounts/manage_access/ under Tester Invites, then open only the new link. The link expires 7 days after we send it. If it has expired or was already opened, tell us and we will send a new one. Do not use Continue with Instagram on the normal login page. That path is only for an organization that has already connected.
```

**Resubmission change.** Rewrite. Tell the reviewer to repeat the path in
the screencast: an accepted tester, **Connect with Instagram** (not
Continue with Instagram on `/login`), then the profile and the campaign.
Delete “use your own account,” the one-time connect link, and “we will add
you as a tester.” The test-credentials field holds the accepted tester.
Say comment **counts**, not “no access to comments.” Say only these two
permissions are requested.
The Facebook Login sentence is accurate. Checklist 1c removed the unused
Business Discovery path, so “Buzz does not use Facebook Login” matches the
code. Org sign-in is Instagram Login only.

### 16. Facebook Login on this platform

**Question**

```text
Is Facebook Login integrated on this platform?
```

**Submitted answer**

```text
No
```

**Resubmission change.** **No** is accurate. Checklist 1c removed the
Business Discovery path that called `graph.facebook.com`. Buzz does not
integrate Facebook Login.

### 17. Test credentials (optional)

**Question**

```text
(optional) If payment or membership is required to access the full functionality of this app, provide access codes or test credentials so we can access and review all features on this app. Codes should be active for one year after submission.
```

**Submitted answer.** Blank.

**Resubmission change.** Fill this in. Provide an accepted tester’s
Instagram login and a Buzz test org that already has a live campaign.
Credentials go in the Meta form only. Do not write “use your own account.”

### 18. Store gift codes (optional)

**Question**

```text
(optional) If payment is required to download this app, provide 8–10 gift codes so we can download it from app stores without payment.Codes should be active for one year after submission.Include any codes or test credentials required to access in-app subscriptions, purchases, or features.
```

**Submitted answer.** Blank.

**Resubmission change.** Leave blank. Buzz is a website; there is no store
download and no in-app purchase.

### 19. Geographic restriction (optional)

**Question**

```text
(optional) If access to this app or any of its features is limited to users within a specific geographic location or restricted by geo-blocking or geo-fencing, explain the restrictions and provide a list of locations.For example, specify the countries where the app can be accessed.
```

**Submitted answer.** Blank.

**Resubmission change.** Leave blank. No geo-block.

### 20. Supporting documentation (optional)

**Question**

```text
Include supporting documentation. (Optional) For example, you can upload a screen recording or images that show how to access the app, log in, and how the app uses Meta APIs. You can upload multiple files, maximum 2 GB each. We accept .xls, .xlsx, .csv, .doc, .docx, .pdf, .txt, .jpeg, .jpg, .png, .ppt, .pptx, .mov, .mp4, .zip and .zipx.
```

**Submitted answer**

```text
buzz-signup-login-demo.mp4
```

**Resubmission change.** Replace that file with the two new captioned
videos from checklist 4. Do not re-upload the rejected signup demo.
