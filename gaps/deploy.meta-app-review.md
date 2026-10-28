---
id: deploy.meta-app-review
title: "Meta App Review (Instagram Login) — review in progress"
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
  Access. The previous submission (2026-10-19, 22:11 PDT) was not approved
  for instagram_business_basic or instagram_business_manage_insights
  (Developer Policy 1.6). Resubmitted 2026-10-28, about 1:14 PM ET
  (17:14 UTC). Review in progress.
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
  their own Instagram Business or Creator account through the temporary
  reviewer link in gaps/deploy.meta-reviewer-path.md (flag off by default).
  Do not put Instagram passwords or a one-time Connect link in the form.
  All other permissions and features were removed on 2026-10-27 (reversible).
  Business Verification is already Verified (2026-10-26) and is not the
  remaining gate. Do not archive on submit alone.
  Do not commit tester passwords, access tokens, or one-time connect links.
---

# Meta App Review (Instagram Login) — review in progress

**Status: Review in progress.** Submitted 2026-10-28, about 1:14 PM ET (17:14 UTC). Meta says most reviews finish within 20 days. Severity stays **P0**. Tracker `status` stays `in_progress` until Advanced Access is approved and the app is Live (`fix_when`). Do not archive on submit alone.

Retired ids: `deploy.meta-business-verification`, `auth.ig-long-lived-get-unsupported`.
Both are pointers in [`gaps/archive/`](archive/). This file is the living gap.

Business Verification is **Verified**. Public org login is still blocked on
**App Review**. The previous submission, **2026-10-19 (22:11 PDT)**, was
**not approved** for `instagram_business_basic` or
`instagram_business_manage_insights` (Developer Policy 1.6 — reviewers could
not verify the use case / login flow). That rejection matches the screencasts
and the form text in the appendix. The same gate is why non-testers, and the
**11 pending** tester invites, get Graph **100** on the long-lived token
exchange. Approval (Advanced Access) plus **Live** mode is the fix. This
file is that workstream. The resubmission below is what Meta has now.

Human Meta dashboard only. Agents verify; do not mutate Meta, submit App
Review, or paste tester credentials without an explicit OK.
[`LAUNCH.md`](../LAUNCH.md) still treats Advanced Access as outside the
seeded revamp: accepted testers can log in without it. Seeded onboarding
stays “add the handle as an Instagram Tester, then Connect.”

App Review is the exception. Reviewers do not get Buzz tester credentials
and do not wait for admin approval. They open the reusable link in
[`deploy.meta-reviewer-path`](deploy.meta-reviewer-path.md), consent with
their own Instagram professional account, and land in the pre-accepted
reviewer org. The code default is off. For this submission
`META_REVIEWER_ACCESS_ENABLED` is **on** and must stay on until Meta
finishes. It does not change `/login` or `/org/apply` for anyone else.

## Resubmission 2026-10-28 (submitted)

**Submitted 2026-10-28, about 1:14 PM ET (17:14 UTC). Status: Review in progress.** Meta says most reviews finish within 20 days. Do not send another submission while this one is open.

| | |
| --- | --- |
| Facebook app | BUZZ `1589568552810678` |
| Instagram app | BUZZ - IG `2056969808271074` |
| Submission id | `1664493731984826` |
| Permissions | `instagram_business_basic`, `instagram_business_manage_insights` |
| Dashboard | [App Review submission](https://developers.facebook.com/apps/1589568552810678/app-review/submissions/?submission_id=1664493731984826&business_id=1622729072857749) |

The previous submission was **2026-10-19 (22:11 PDT)** and was **not approved** for both permissions. This file previously dated that request 2026-10-07. The appendix is still that rejected form. The blocks below are the fields saved on the 2026-10-28 draft and submitted that afternoon. Brand login values and the reviewer-link secret are not in this repo.

### What changed vs the rejection

1. Reviewers get a reusable reviewer link into a pre-approved test organization already in "Meta Review Test Drop", plus a brand login in the credentials field. The rejected form used a one-time connect link, told reviewers they could not finish without a tester role, and left credentials blank.
2. Each screencast shows Instagram Login, the first-time **BUZZ - IG** consent screen listing both permissions, and English captions. The rejected videos showed a re-authorization screen with no permission list; the insights video had no login or captions.
3. Usage text says comment counts only, never comment text.
4. Usage text names every feed and reel metric.
5. The brand view is a real brand sign-in at `/brand/login`.
6. A short walkthrough of the reviewer steps is the supporting documentation. The old signup demo was removed. This submission has no notes-to-reviewer box.

### App settings

- App category: Business and pages
- Privacy policy URL: `https://www.bringthebuzzover.com/privacy`
- Primary contact email: `<primary contact email (kept off-repo)>`
- Business: Bring the Buzz Over (verified)

### Allowed usage — `instagram_business_basic`

Tell us how you're using this permission or feature:

```text
BUZZ (bringthebuzzover.com, Bring the Buzz Over Inc.) is a website that connects brands with student organizations for sponsored Instagram campaigns ("drops"). A brand ships product to student organizations, and each organization posts about it on its own Instagram professional account. The organization connects that account to BUZZ with Instagram Login (Business Login for Instagram). BUZZ does not use Facebook Login.

We use instagram_business_basic for three things, all for the account the organization itself connected:
1. Identify the account: user id, username, account type and follower count. The organization's Profile page in BUZZ shows them as "Instagram identity" and "Instagram followers (from Instagram)". We use the account type to accept only Business or Creator accounts.
2. List the account's own recent media (id and timestamp), so the organization can pick, from its existing posts, the one it made for a campaign. Under the campaign's "Linked posts", the organization clicks Link on that post.
3. For a linked post, read its like count, comment count, caption, media type, permalink, thumbnail or media URL and timestamp. The organization sees these on its campaign page, and the sponsoring brand sees the same post and counts in that campaign's reporting.

Why we need it: without it, BUZZ cannot confirm which Instagram account belongs to the organization, cannot show the organization its own posts to choose from, and cannot show the brand which post was made for its campaign. Brands would have to trust screenshots, and organizations would have to copy numbers by hand.

What we do not do: we read comment counts only, never comment text. We never publish, edit or delete content, never comment or reply, and never read or send messages. We only read the account that the organization connected and approved.

How to test: follow the Web reviewer instructions (App Verification). Open the reviewer link, sign in with your own Instagram professional account and click Allow. You land in our pre-approved test organization "Meta App Review". Open Profile to see your @username and follower count, then open My Campaigns > Meta Review Test Drop, where Linked posts lists your own recent posts with like and comment counts. Click Link on one. The attached video shows the same Instagram Login, consent and data for a real student organization that signed up through our normal apply and approval process.

```

- Screencast: Facebook video `1809141633545591` (`video-A-basic-2026-10-28.mp4`)
- Allowed-usage agreement: ticked

### Allowed usage — `instagram_business_manage_insights`

Tell us how you're using this permission or feature:

```text
Brands pay for BUZZ campaigns and need to know how the posts made for them performed. When a student organization links one of its own Instagram posts to a brand campaign in BUZZ, we use instagram_business_manage_insights to read that one post's media insights from the organization's own professional account:
- Feed posts: reach, views, saved, shares, total_interactions, profile_visits, profile_activity, follows.
- Reels: reach, views, saved, shares, total_interactions, ig_reels_avg_watch_time, ig_reels_video_view_total_time, reels_skip_rate.

Where it is shown:
- The organization's campaign page shows an "Instagram insights" row under each linked post (Reach, Views, Saves, Shares, Total interactions, and Profile visits, Profile activity and Follows for feed posts), plus an "Instagram Reach" summary tile for the campaign.
- The sponsoring brand's campaign page shows the same post with the same insights row, so the brand sees verified results for its campaign.

Value to users: organizations prove the reach of the posts they made without sending screenshots, and brands get accurate, comparable results for each campaign. Without this permission BUZZ could show likes and comments only, which does not tell a brand how many people a post reached.

Limits: we read insights only for posts the organization linked to a campaign, only from the account it connected, and only to report on that campaign to that organization and that brand. We do not read account-level audience demographics. We never publish content, comment, or read or send messages.

How to test: after the steps in the Web reviewer instructions, open My Campaigns > Meta Review Test Drop and look at one of your recent posts under Linked posts. Its Instagram insights row shows that post's metrics from Instagram. Click Link, and the campaign's Instagram Reach total updates. Then log out and sign in as the brand (credentials field). The brand's Meta Review Test Drop page shows the posts linked to that campaign, including the one you linked, with the same insights. The attached video shows the same steps for a real student organization and a real brand sign-in.

```

- Screencast: Facebook video `1439926917470842` (`video-B-insights-2026-10-28.mp4`)
- Allowed-usage agreement: ticked

### Data handling

Prefilled from the previous submission and confirmed unchanged.

| Question | Submitted answer |
| --- | --- |
| Data processors with access to Platform Data? | Yes |
| Which processor | Railway |
| Processor category | IT solutions and services, including cloud storage and processing |
| Processor countries | United States of America |
| Responsible entity | Bring the Buzz Over Inc. |
| Entity country | United States of America |
| National-security / public-authority requests, last 12 months | No |
| Policies for public-authority requests | None of the above |

### Verification / reviewer instructions (Web)

- Platform: Web
- Site URL: `https://www.bringthebuzzover.com/`
- Is Facebook Login integrated? No
- Supporting documentation: `how-to-test-buzz-2026-10-28.mp4` (the old `buzz-signup-login-demo.mp4` was removed)
- Gift codes: blank
- Geographic restrictions: blank
- No notes-to-reviewer box and no custom form step

Step-by-step instructions for reviewers:

```text
BUZZ is a website: https://www.bringthebuzzover.com. Please use a desktop browser. No payment or membership is needed. BUZZ does not use Facebook Login. Student organizations sign in only with Instagram Login (Business Login for Instagram), and we request only instagram_business_basic and instagram_business_manage_insights. BUZZ never posts, comments or sends messages on Instagram.

You need your own Instagram professional account (Business or Creator) with at least one post published in the last 30 days. BUZZ reads recent posts only, so older posts will not appear in the list. If your account has no posts from the last 30 days, the Linked posts list will be empty. You can still see both permissions in use: Profile shows your @username and follower count, and the brand view in steps 8-9 shows a post already linked by our other test organization, BUZZ Review Test Org, with its like and comment counts and its Instagram insights.

Normally an organization applies, verifies a .edu email and waits for our approval before it connects Instagram. To save you that wait, we prepared an approved test organization named "Meta App Review" that is already accepted into a test campaign, "Meta Review Test Drop". The reviewer link in the test credentials field connects your Instagram account to that organization.

instagram_business_basic and instagram_business_manage_insights (organization side):
1. Open the reviewer link from the test credentials field. BUZZ sends you to Instagram.
2. If Instagram asks, sign in with your own Instagram professional account.
3. Instagram shows its consent screen: "BUZZ - IG is requesting access to" your account, listing "View profile and access media" (instagram_business_basic) and "Access and manage insights" (instagram_business_manage_insights). Click Allow.
4. BUZZ finishes the login and signs you in to the "Meta App Review" organization. BUZZ reads your recent posts right away.
5. Click Profile. "Instagram identity" shows your @username, and "Instagram followers" shows your follower count from Instagram (instagram_business_basic).
6. Open My Campaigns, then Meta Review Test Drop. Under Linked posts, BUZZ lists your own recent posts with their like and comment counts (instagram_business_basic). Each post has an Instagram insights row with its reach, views, saves, shares, total interactions and, for feed posts, profile visits, profile activity and follows (instagram_business_manage_insights). A dash means Instagram returned no value for that metric.
7. Click Link on one existing post. BUZZ only records the link to the campaign; nothing is created or changed on Instagram. The campaign totals (posts, likes, comments, Instagram Reach) update.

instagram_business_manage_insights (brand side):
8. Click Logout. Go to https://www.bringthebuzzover.com/brand/login and sign in with the brand account from the test credentials field.
9. Open Meta Review Test Drop. The brand sees each linked post, including the one you just linked, with its like and comment counts and its Instagram insights row.

A short walkthrough video of these steps is attached under supporting documentation and is also here: https://drive.google.com/file/d/1XinyIPC_2PK4-jjMshzpIJQrXGJx7Mc3/view

If Instagram shows "Insufficient developer role", send us your Instagram username and we'll add it as a tester. You can reply in this App Review request or email hello@bringthebuzzover.com. Then accept the invite at https://www.instagram.com/accounts/manage_access/ (Tester Invites) and open the reviewer link again.

Metrics come from Instagram and can take up to 48 hours to update, so numbers may differ slightly from the videos. To sign in again later, open the reviewer link again.
```

Test credentials (the link secret and the brand login are kept off-repo):

```text
1) Reviewer link (connects your own Instagram professional account to our approved test organization "Meta App Review"; reusable during the review): https://www.bringthebuzzover.com/meta-review#<TOKEN>
2) BUZZ brand account "BUZZ Review Test Brand", sign in at https://www.bringthebuzzover.com/brand/login
Email: <brand test account email (kept off-repo)>
Password: <brand test account password (kept off-repo)>
No Instagram or Facebook credentials are needed or provided. Please use your own Instagram professional account.
```

### While Meta is reviewing

`META_REVIEWER_ACCESS_ENABLED` stays **on**. Leave the reviewer secret hash set. Do not turn the flag off until Meta finishes.

### After approval

1. Turn `META_REVIEWER_ACCESS_ENABLED` off.
2. Purge the reviewer org (`Meta App Review`) with the purge step in [`backend/app/meta_reviewer/REMOVAL.md`](../backend/app/meta_reviewer/REMOVAL.md).
3. Unset the reviewer secret hash (`META_REVIEWER_LINK_SECRET_HASH`).
4. Keep the reviewer-path code. Delete those files per `REMOVAL.md` only if asked later.

Then switch the app to Live and confirm a non-tester login (META.md §G, `fix_when` above). Do not archive this gap on submit alone.

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

Rechecked **2026-10-27**, both were Active and **App Review rejected**. Resubmitted **2026-10-28, about 1:14 PM ET (17:14 UTC)**; **Review in progress**. Last 30 days as of that 2026-10-27 check: `instagram_business_basic` 968 calls, `instagram_business_manage_insights` 291.

Requested via `INSTAGRAM_SCOPES` in `backend/app/config.py`.

| Permission | Why we need it | Where in code |
| --- | --- | --- |
| `instagram_business_basic` | Identify the connected org account (`id` or `user_id`, `username`, `account_type`, `followers_count`). List its media (`id`, `timestamp`). For linked posts, read `like_count`, `comments_count`, `caption`, `media_type`, `media_product_type`, `permalink`, `thumbnail_url`, `media_url`, `timestamp`. Shown on the org profile and campaign. | `fetch_profile`, `fetch_user_media`, `fetch_media` in `backend/app/services/instagram.py` |
| `instagram_business_manage_insights` | Post insights for linked posts. Feed: `reach`, `views`, `saved`, `shares`, `total_interactions`, `profile_visits`, `profile_activity`, `follows`. Reels: `reach`, `views`, `saved`, `shares`, `total_interactions`, `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`, `reels_skip_rate`. Each Instagram post on the org campaign Linked posts card and the brand drop posts list shows an Instagram insights row for the metrics requested for that media type (admin View as uses those pages). Summed reach still appears as Instagram Reach / Total reach. A missing value is an em dash. | `_FEED_INSIGHT_METRICS` and `_REEL_INSIGHT_METRICS` in `instagram.py` (`fetch_media_insights`) |

`public_profile` is a Meta default. It can't be removed, has 0 calls, and is not requested.

All other permissions and features were removed on 2026-10-27 (reversible).

There are no `graph.facebook.com` calls.

### Submission

The previous submission was **2026-10-19 (22:11 PDT)** for
`instagram_business_basic` and `instagram_business_manage_insights`. It was
**not approved** for either permission (Developer Policy 1.6). The export
reproduced in the appendix was downloaded 2026-10-26, 9:34 AM PDT. This file
previously dated that request 2026-10-07. The one-time connect token in that
export is `[REDACTED]`.

The replacement request was **submitted 2026-10-28, about 1:14 PM ET (17:14 UTC)**.
Status: **Review in progress.** See [Resubmission 2026-10-28 (submitted)](#resubmission-2026-10-28-submitted).

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
| 3 | Give Meta the reviewer link from [`deploy.meta-reviewer-path`](deploy.meta-reviewer-path.md). Reviewers use their own Instagram Business or Creator account. Do not put Instagram passwords in the test-credentials field. | Lawrence | **Done (submitted 2026-10-28).** The credentials field uses `https://www.bringthebuzzover.com/meta-review#<TOKEN>`. The secret stays out of git. `META_REVIEWER_ACCESS_ENABLED` stays **on** until Meta finishes. After approval: turn the flag off, purge the reviewer org, unset the reviewer secret hash. Keep the reviewer-path code unless removal is asked for. |
| 4 | Record two captioned videos (English). Each file contains its own login, grant, and that permission’s data. See the recording bar below. | Lawrence | **Done.** Facebook videos `1809141633545591` (basic) and `1439926917470842` (insights), plus supporting `how-to-test-buzz-2026-10-28.mp4`. |
| 5 | Rewrite each permission’s usage description. Name the fields and metrics. Say “comment counts,” not that Buzz has no access to comments. Say only these two permissions are requested. | Engineering drafts; Lawrence confirms | **Done.** Text is in [Resubmission 2026-10-28 (submitted)](#resubmission-2026-10-28-submitted). |
| 6 | Submit | Lawrence | **Done.** Submitted 2026-10-28, about 1:14 PM ET (17:14 UTC). Submission `1664493731984826`. **Review in progress.** Do not archive on submit alone. |

Items 3–6 are the 2026-10-28 submission. The recording bar below is the earlier plan. The uploaded permission screencasts show the normal organization path (apply, approval, Instagram Login, consent, and that permission’s data). The supporting video shows the reviewer link. The written instructions tell the reviewer to use the link.

**Recording bar.** Use the reviewer link
([`deploy.meta-reviewer-path`](deploy.meta-reviewer-path.md)), not a Buzz
tester password and not `/login`. The Instagram account must be Business or
Creator and not already authorized for Buzz (remove the app first, or use
an account that has never approved it). The link runs Instagram Login and
the consent screen, then signs in as the pre-accepted reviewer org.
**Continue with Instagram** on `/login` is only the returning path, and
only after that account is already the org’s login. An unknown account on
`/login` is still `ORG_APPLY_REQUIRED`.

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
  = Review in progress (submitted 2026-10-28, about 1:14 PM ET / 17:14 UTC)
  until Meta approves or rejects
Instagram Testers → accepted count is what can log in
```

Re-check App Review status before claiming §F done. While this review is
open, `META_REVIEWER_ACCESS_ENABLED` stays on. §G (non-tester login on www)
is still required to archive.

## Docs left on the old story

Not edited here. It still disagrees with this file:

- [`ideas/org-bind-at-signup.md`](../ideas/org-bind-at-signup.md) still cites
  `business_verification_passes: false` (2026-09-14). The link to this gap
  is updated; that 2026-09-14 sentence is not. Ideas are not SOT.

## Related

- [`META.md`](../META.md) — dashboard guide; §E done; §F is Review in progress.
- [`archive/ops.ig-business-discovery-unset`](archive/ops.ig-business-discovery-unset.md) — path removed (checklist 1c). Delete leftover Railway vars if present.
- [`archive/auth.ig-long-lived-get-unsupported.md`](archive/auth.ig-long-lived-get-unsupported.md) — absorbed id.
- [`archive/deploy.meta-business-verification.md`](archive/deploy.meta-business-verification.md) — renamed id.

## Appendix: Rejected form — full questions and our answers

Historical. This is the previous submission, **2026-10-19 (22:11 PDT)**, which
was **not approved** for `instagram_business_basic` or
`instagram_business_manage_insights`. This file previously dated that request
2026-10-07. Each **Resubmission change** note was a draft instruction and is
not the text that was submitted. The submitted text is
[Resubmission 2026-10-28 (submitted)](#resubmission-2026-10-28-submitted).

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
