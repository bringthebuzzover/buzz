# UI defect map (revamp baseline)

Generated in the UI revamp audit phase from the `before` screenshot atlas
(`npm run atlas`, 44 surfaces x 3 viewports) by three parallel audit agents,
re-audited after a harness fix, then line-verified by an independent agent.
Of 96 raw claims, 84 verified at the cited line, 8 were visual claims consistent
with the cited code, 2 were duplicates, and 0 had materially wrong citations.

This file is the work contract for the migration phase. Do not add defects here
without a verified `file:line`.

## How to read it

- **Owner** decides who fixes it: `system` = the token/primitive pass (single
  writer), `auth`/`org-brand`/`admin` = the parallel area appliers.
- Severity: `high` looks broken or unprofessional, `med` visibly inconsistent,
  `low` nitpick.
- Ids `a*`/`b*`/`c*` come from the three audit teams, `r*` from the re-audit of
  corrected shots. Ids are stable — cite them in commits.

## Hard constraints (read before editing anything)

These come from the verification pass. Violating one breaks a green test.

1. **Do not change `type="number"` or `type="datetime-local"`.** Suppress the
   native spinner and calendar glyph with CSS only. `e2e/admin.spec.ts` fills
   `draft-open-at`/`draft-close-at` and `OrgApplyPage.test.tsx:360` drives the
   member-count field.
2. **Converting a bare `<input>` to `TextField` requires passing an explicit
   `id`.** `e2e/admin.spec.ts:218,230` use `getByLabel(/^title$/i)`, which today
   resolves only because the `<label>` wraps the input. `TextField` renders the
   label as a sibling with `htmlFor={id}`.
3. **Do not restructure the label/input relationship on `OrgApplyPage`.**
   `OrgApplyPage.test.tsx:107-125` finds controls via
   `label.parentElement.querySelector("input, textarea, select")`.
4. **Do not swap `<Link>` for `<button>` (or the reverse) in admin tables.**
   `e2e/admin.spec.ts:182` clicks `getByRole("link", {name: /^open$/i})` and
   `:247` clicks `getByRole("button", {name: "Hidden"})`.
5. **Preserve every `data-testid`, placeholder, and the copy "Restoring your
   session…".** `e2e/org.spec.ts:32` queries `getByPlaceholder(/optional
   pitch/i)`; the atlas settle helper waits on the restoring copy.
6. **Header/footer geometry is asserted.** `e2e/org.spec.ts:60-88` checks that
   header nav never intersects the centered logo via `boundingBox()`;
   `marketing.spec.ts:53-72` queries the footer by `contentinfo` role.
7. **`Checkbox` `className` currently lands on the `<input>`.** Rerouting it to
   a wrapper touches every call site, including `FilterMultiSelect`, which
   forwards `role="option"`/`aria-selected` through the same spread.

## Deferred — needs a product decision, not a token (do not fix in this pass)

| id | surface | why deferred |
| --- | --- | --- |
| c1 | admin orgs/brands/drops/requests | 6-7 column tables clip at 375px. Any real fix stacks rows, hides columns, or adds a priority system, i.e. changes what an admin sees. `AdminPrimitives.tsx:128` |
| c13 | admin-requests | Pill prints the raw enum (`received`) instead of a label. `STATUS_LABELS` exists but the wording is a copy decision. `AdminDropRequestsPage.tsx:84` |
| b31 | brand-drop-detail | Wide applicant table has no scroll affordance; a sticky column or fade is new UI. `BrandDropDetailPage.tsx:151` |
| b19 | org-profile | Read-only follower count imitates a field. Making it a real disabled input turns a Graph-owned display value into a form control. `OrgPortalProfilePage.tsx:273` |
| c10, c11 | admin-brand-detail, admin-drops | "Applied/Accepted" cells are `"3 / 20"` composites, not bare numerals; right-aligning them is cosmetic churn and splitting them adds columns. |

## Coverage holes in the atlas

| surface | why not captured |
| --- | --- |
| `/brand/setup` | Redirects to `/` without a valid `?token`; the seed mints no brand invite token. |
| `/onboarding/connect-instagram` connect CTA | Needs a `pending_instagram` session. Only the bad-token failure state is shot. |
| `/onboarding/profile`, `/onboarding/pending-approval` | The seeded org is already active, so both self-route away. |
| `/auth/instagram/callback` | Transient OAuth bounce. |

---

## System-owned defects (single writer, token + primitive pass)

These are the high-leverage rows. Each one, fixed once, closes many surfaces.

### Shells and centering — `frontend/src/theme/shells.ts`

| id | severity | defect | evidence |
| --- | --- | --- | --- |
| a29 / r4 | high | `AUTH_SHELL.center` centers inside `min-h-[60vh]`, ignoring the ~136px header and the footer, so all 12 centered auth/onboarding surfaces sit above optical center | `theme/shells.ts:7`, `layouts/SiteLayout.tsx:16` |
| r2 | high | `AUTH_SHELL.center` is `flex flex-col` with default `align-items: stretch`, so link-styled CTAs with hug padding render full-bleed. Callers disagree: Login/Reconnect/ConnectInstagram pass `items-center`, Denied/VerifyEmail/BrandApply do not | `theme/shells.ts:5-7`, `ConnectInstagramPage.tsx:77,84-89`, `BrandApplyPage.tsx:69,77-82` |
| r24 | low | `AUTH_SHELL.stack` is `py-16` while `.center` is `py-24`, so org-apply starts 32px higher than its siblings | `theme/shells.ts:5-9` |
| a34 | low | Five reading pages hand-write `mx-auto max-w-3xl px-8 py-16` instead of `PAGE_SHELL` + `PAGE_WIDTH.reading` | `ForOrgsPage.tsx:20`, `ForBrandsPage.tsx:18`, `legal/LegalLayout.tsx:17` |
| c19 | med | Admin content area ignores the shell SOT (`px-5 py-6 sm:px-8`, no width cap), so tables stretch edge to edge at 1440px | `layouts/AdminLayout.tsx:16` |

### Missing tokens — `frontend/src/theme/palette.ts`, `frontend/tailwind.config.js`

| id | severity | defect | evidence |
| --- | --- | --- | --- |
| a3 / a18 / r16 | high | Warning and success washes have no `buzz-*` pair, so raw `amber-*`/`green-*` leaks into 6+ files while danger has `ErrorBanner` | `OrgApplyPage.tsx:273,373,394,576`, `ForgotPasswordPage.tsx:55`, `VerifyEmailPage.tsx:386,468`, `ShippingAddressFields.tsx:163` |
| c22 | med | `AdminPrimitives` tone map uses stock `green-300/50/800`, `amber-300/50/800`, `red-300/50/700`. Most hexes match the tokens, but the `*-300` borders have no token at all | `AdminPrimitives.tsx:22-26,370,380,405` |
| c23 | med | `text-green-700` (#15803d) is not `buzz-success` (#166534) — a genuine off-token color | `AdminDropDetailPage.tsx:345`, `AdminDropRequestDetailPage.tsx:483` |
| v5 | med | A third stock green (`text-green-600`) on brand drop detail | `BrandDropDetailPage.tsx:298,423` |
| v6 | med | `StatusPill` tones and the submitted toast use stock `green-200/50/800` + `amber-*` beside buzz-token chips on the same page | `BrandAggregateDashboardPage.tsx:62-65,211` |
| v3 | med | Stock `text-red-600` on an otherwise fully tokenized card | `DropFeedCard.tsx:280` |
| v4 | med | `rounded-lg bg-green-50 text-green-700` success panel in the org portal | `OrgPortalProfilePage.tsx:346` |
| a20 / a32 / r13 | med | `z-[100]`, `z-[55]`, `z-[50]` written as arbitrary values although `buzzBanner`/`buzzDrawer`/`buzzModal` exist. The modal currently ties the header's open-nav layer | `ContactModal.tsx:18`, `SiteHeader.tsx:126,283` |
| a30 / r18 / v2 | low | `text-[10px] font-bold uppercase` hand-written although `fontSize.buzzMicro` is exactly `0.625rem`/700 | `ContactModal.tsx:51,68,91`, `Marquee.tsx:70` |

### Form primitives — `frontend/src/components/forms/`

| id | severity | defect | evidence |
| --- | --- | --- | --- |
| a13 / r1 | high | The Instagram CTA is hand-rolled `rounded-xl border-2 px-8 py-4 text-base shadow-sm`, duplicated in three files, against `Button variant="outline"`'s `rounded-buzzControl px-4 py-3 text-sm` | `LoginPage.tsx:42`, `ReconnectInstagramPage.tsx:30`, `ConnectInstagramPage.tsx:140` |
| a2 / r11 | high | Disabled primary is only `opacity-60` coral, which reads as a broken button rather than a gated one. Fix the treatment only — do not add explanatory copy (that is PRODUCT) | `controls.tsx:175`, `OrgApplyPage.tsx:512` |
| a11 / a11b / r3 | med | `ErrorBanner` renders *after* the submit button (and after "Forgot password?") on 6 auth pages, while org-apply puts it first | `BrandLoginPage.tsx:117-125`, `AdminLoginPage.tsx:117-126`, `ForgotPasswordPage.tsx:81`, `ResetPasswordPage.tsx:95`, `BrandSetupPage.tsx:112`, `BrandApplyPage.tsx:168` |
| r12 | med | `disabled:cursor-not-allowed` is on `primary` only, so disabled `outline`/`ghost` still take a pointer cursor | `controls.tsx:174-178` |
| c26 | low | `datetime-local` shows the native calendar glyph beside `Select`'s custom chevron. **CSS only** — see constraint 1 | `controls.tsx:104` |
| a27 | low | `type="number"` shows native spinners inside a Buzz field. **CSS only** — see constraint 1 | `OrgApplyPage.tsx:443` |
| r22 | low | `TextArea` hardcodes `resize-y`, showing the OS resize grabber; make it opt-in | `controls.tsx:80` |
| c27 | low | `Checkbox` forwards `className` to the `<input>`, so `mt-1` moves the box off its own text baseline. See constraint 7 | `Checkbox.tsx:13`, `AdminDropDetailPage.tsx:263,295` |

### New primitives to add

| what | closes | why |
| --- | --- | --- |
| `Card` / `Surface` with token radius + one shadow | a4, a7, a8, a19, b14, b20, b22, b23, b24, b27, b28, c9, r21, v9 | 11 `rounded-*` variants and 5 shadows across 171/53 uses; `rounded-buzzCard`/`buzzControl`/`buzzModal` exist and are used 5 times total |
| `Chip` (one micro-pill) | b15, b26, c21, c25, and the chip string duplicated on 5 surfaces | `rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider` is copy-pasted in `DropFeedCard.tsx:100`, `CampaignRow.tsx:49`, `OrgCampaignDetailPage.tsx:100`, `BrandDropTrackerStepper.tsx:31`, `BrandAggregateDashboardPage.tsx:68` |
| `SuccessBanner` + `WarningBanner` beside `ErrorBanner` | a3, a18, r16, v4, v6, c28, b25 | Only danger has a banner today |
| `StatePanel({tone})` for loading/empty/error | b29, a17, a17b, r15, c-list-pages | The same `p-12` box appears 3x in `OrgDropFeedPage`, 3x in `OrgMyCampaignsPage`, 2x in `BrandAggregateDashboardPage`; 5 files duplicate `flex min-h-[60vh] items-center justify-center`; 4 admin list pages re-implement loading/error as a bare `<p>` |
| One auth/section heading class (weight <= 600) | a6, a12, a23, b9, c14, r5, r7, b17 | `font-black` in 23 places; four different h2 treatments on the home page alone; `font-black` KPIs outweigh their own page `h1` |
| `Modal` primitive (scroll lock + Escape + focus trap) | r14, v8 | `ContactModal` has no `useEffect`, no Escape handler, no scroll lock, and no backdrop close, while `SiteHeader:89-96` already implements the lock for its drawer |
| Single tone map | c22, and the 3-way duplication | `AdminPrimitives.TONE_CLASS`, `BrandAggregateDashboardPage.toneClass`, `CampaignRow.STATUS_TONE` |

---

## Area-owned defects

### auth + onboarding + public

| id | severity | surface | defect | evidence |
| --- | --- | --- | --- | --- |
| a1 | high | org-apply | ~13-field form locked to `max-w-md`, so City/State/ZIP render ~100px wide with 1000px of empty page | `OrgApplyPage.tsx:262` |
| a5 | high | home | Featured section is `py-7` while neighbours are `py-16`/`md:py-20` | `FeaturedCollaborations.tsx:9` |
| a9 | high | all | Footer logo is pushed out of column with `-translate-x-2 -translate-y-3 -mb-4` | `SiteFooter.tsx:22` |
| a10 / r6 | high | not-found | Hand-rolls `max-w-lg px-8 py-24`; `max-w-lg` is not a `PAGE_WIDTH` value | `NotFoundPage.tsx:9` |
| a24 | med | org-apply | City/State/ZIP stay `grid-cols-3 gap-3` at 375px (~75px usable per field) | `ShippingAddressFields.tsx:235` |
| a25 / r10 | med | org-apply | Shipping fieldset is `space-y-3` inside a `space-y-4` form | `ShippingAddressFields.tsx:154` |
| a14 / r20 | med | login, reconnect | Trailing link stack uses `mt-8`, `mt-3`, `mt-4` for three equal-rank lines | `LoginPage.tsx:50,56,62`, `ReconnectInstagramPage.tsx:38,44` |
| a15 | med | brand-apply | Uses `align="center"` while the sibling org-apply uses `align="stack"` | `BrandApplyPage.tsx:110` |
| a16 | med | brand-apply | Success CTA is a `Link` hand-styled as a button | `BrandApplyPage.tsx:79` |
| a21 | med | for-orgs | Stock `emerald-100/800` pill. Note: the `ForBrandsPage.tsx:113` half of the original claim is inline `text-emerald-700` text, not a pill | `ForOrgsPage.tsx:111` |
| a22 | med | home | Marquee tiles `h-32 w-32` with `space-x-16` fit only two logos at 375px | `Marquee.tsx:47,54` |
| a26 | med | for-orgs, for-brands, home | `shadow-sm` is a third shadow family beside `shadow-buzz`/`buzzLg`. Note: `TourFrame` has no `hover:shadow-md` | `TourFrame.tsx:16` |
| r9 | med | org-apply | The `Shipping address (US)` legend is byte-identical to `fieldLabelClass`, so the grouping is invisible | `ShippingAddressFields.tsx:155-157` |
| r17 | low | denied, bad-token states | Failure headlines use `text-buzz-coral`, the positive-CTA accent, not a danger tone | `DeniedPage.tsx:12`, `ConnectInstagramPage.tsx:77-80`, `VerifyEmailPage.tsx:276-278` |
| b12 | med | denied | Terminal denial is bare centered text with no panel | `DeniedPage.tsx:15` |
| b10, b11 | med | connect-instagram | Two hand-rolled buttons (`rounded-xl px-8 py-4`, `rounded-lg px-6 py-3`) | `ConnectInstagramPage.tsx:140,86` |
| a4, a6 | high | home | Three card radius families and four `h2` treatments on one page | `FeaturedCollaborations.tsx:17`, `Marquee.tsx:40` |
| a7, a8 | high | for-orgs, for-brands | Tour mock internals mix 2-3 radii inside a `rounded-2xl` frame | `ForBrandsPage.tsx:91`, `ForOrgsPage.tsx:105` |
| a28 | low | for-orgs | Two mock CTAs use `font-semibold` (:126) and `font-bold` (:94) for the same element | `ForOrgsPage.tsx:126,94` |
| a31 | low | mobile header | Hamburger uses raw `border-white/30 bg-white/10 rounded-lg` | `SiteHeader.tsx:260` |
| a33 | low | home | Hero is a hard `h-[700px]`, 86% of a 812px viewport | `HomeHero.tsx:11` |
| a23 / r5 | med | legal, not-found | Legal `h1` is `text-4xl font-black text-buzz-coral`; 404 the same, both off the auth `h1` rank | `legal/LegalLayout.tsx:18`, `NotFoundPage.tsx:10` |
| r19 | low | contact-modal | Four paddings stack in one card (`p-8`, `p-6`, `p-3`, `p-2.5`) | `ContactModal.tsx:29,45,46,47,62,64` |
| r23 | low | brand-login, admin-login | "Forgot password?" is `text-xs` while sibling secondary text is `text-sm` | `BrandLoginPage.tsx:117`, `AdminLoginPage.tsx:117` |
| r21 | low | org-apply | Business/Creator callout `rounded-lg px-3 py-3` instead of `rounded-buzzControl p-3` | `OrgApplyPage.tsx:278` |
| v7 | med | org-apply | `lookupError` is bare `text-amber-900` text while the sibling `legacyHint` of the same severity is a bordered panel | `ShippingAddressFields.tsx:282,163` |

### org + brand portals

| id | severity | surface | defect | evidence |
| --- | --- | --- | --- | --- |
| b1 | high | org-browse | Card root lacks `h-full`, so side-by-side cards end at different heights | `DropFeedCard.tsx:88` |
| b2 | high | org-browse | `flex flex-wrap justify-center` centers the third card under the gutter instead of on a grid | `OrgDropFeedPage.tsx:107` |
| v10 | high | org-browse | `w-full max-w-sm` caps every card at 384px inside a `max-w-6xl` shell, leaving a ragged gutter at >=1024px. b2's grid fix alone does not remove this | `OrgDropFeedPage.tsx:110` |
| b3 | high | org-campaigns | Brand pill text wraps to two lines inside a `rounded-full` chip at 375px | `CampaignRow.tsx:53` |
| b4 | high | brand-dashboard | Conditional `idx > 0` `border-l` leaves a stray vertical rule when the totals bar wraps at 375px | `RunningTotalsBar.tsx:36` |
| b5 | med | brand-dashboard | `justify-between` makes each divider hug its own item instead of sitting between groups | `RunningTotalsBar.tsx:31` |
| b6 | med | brand-drop-detail | Six sibling sections each carry an ad-hoc `mt-8`; inner stacks alternate `space-y-3/4/6` | `BrandDropDetailPage.tsx:122,321,516,538,547,552` |
| b7 | med | brand-dashboard | Compare table keeps `px-6` cells at 375px; only 3 of 5 columns visible | `ApiCompareDropsTable.tsx:40` |
| b8 | med | brand-dashboard | Five tiles on `grid-cols-2` strand the last tile alone (also at `sm:grid-cols-3`) | `AggregateTotalsCards.tsx:49` |
| b16 | med | org-browse | One card carries five type sizes, plus two more in the countdown overlay | `DropFeedCard.tsx:100,108,111,115,226` |
| b17 | med | org-campaign-detail | KPI numerals are `text-2xl font-black`, heavier than the `text-3xl font-bold` h1 | `OrgCampaignDetailPage.tsx:169` |
| b18 | med | org-profile | Three label typographies in one form | `OrgPortalProfilePage.tsx:208,269` |
| b21 | med | brand-request-new | Submit uses `size="hero"` beside `p-3 text-sm` textareas | `BrandRequestDropPage.tsx:75` |
| b24 | low | org-campaign-detail | Post selector nests three radii and three paddings | `ApiPostSelector.tsx:110,146,91` |
| b25 | low | org-campaign-detail | Raw `border-red-200 bg-red-50 text-red-700` instead of `ErrorBanner` | `ApiPostSelector.tsx:62` |
| b29 | low | org-browse | Loading, empty, and error reuse one `p-12` box; error differs only by text color | `OrgDropFeedPage.tsx:103,180,191` |
| b32 | low | org-browse | Inline apply form hand-rolls textarea and buttons. Preserve the placeholder and `apply-submit` testid (constraint 5) | `OrgDropFeedPage.tsx:241` |

### admin

| id | severity | surface | defect | evidence |
| --- | --- | --- | --- | --- |
| c2 | high | admin-drop-detail | Tab bar is a plain `flex`, so "Attribution" is clipped at 375px | `AdminDropDetailPage.tsx:786` |
| c3 | high | admin-drop-detail | 9 bare `<input>` + 1 bare `<textarea>` on `fieldClass.compact`; the textarea misses `resize-y` and none get label association. Needs explicit `id` (constraint 2) | `AdminDropDetailPage.tsx:202,212,222,232,242,253,286,488,502,538` |
| c4 | high | admin-drop-detail | Two label greys collide in one screen (`inkFaint` hand-rolled vs `inkMuted` from `fieldLabelCompactClass`) | `AdminDropDetailPage.tsx:485,499,535` vs `theme/controls.ts:20` |
| v1 | high | admin-drop-detail | Three inputs use `<div className="block">` + `<span>` pseudo-label while identical siblings use `<label>`, so they have no label association at all | `AdminDropDetailPage.tsx:251,284,302` |
| c5 | med | admin shared | Sidebar footer block lacks `px-3`, so it starts 12px left of every nav label | `AdminSidebar.tsx:96` vs `:77,161` |
| c6 | med | admin shared | Page gutter is 20px but the mobile top bar is 16px, so every h1 is indented 4px from the Menu button | `layouts/AdminLayout.tsx:16` vs `AdminSidebar.tsx:127` |
| c7 | med | admin shared | `ActionButton` disables at `opacity-40` vs `Button`'s `opacity-60` | `AdminPrimitives.tsx:412` vs `controls.tsx:175` |
| c8 | med | admin-request-detail | `FieldGrid`'s `lg:grid-cols-3` renders inside a `lg:grid-cols-2` wrapper, crushing 3 fields and stranding the 4th | `AdminPrimitives.tsx:348` at `AdminDropRequestDetailPage.tsx:528` |
| c14 | med | admin-overview | Queue counts are `text-3xl font-black`, a 4th size and the only >600 weight in the panel | `AdminOverviewPage.tsx:47` |
| c15 | med | admin-drop-detail, admin-org-detail | Confirm panels open with `px-4 pb-4` (no top padding), so content butts the header divider | `AdminDropDetailPage.tsx:682,702`, `AdminOrgDetailPage.tsx:291` |
| c16 | med | admin-org-detail, admin-brand-detail | `py-0.5` pill sits beside `py-1.5 border-2` buttons under `items-center` | `AdminOrgDetailPage.tsx:213`, `AdminBrandDetailPage.tsx:127` |
| c17 | med | admin-brands, drop-detail, request-detail | Compact fields are ~36px but `ActionButton` is ~32px | `theme/controls.ts:14` vs `AdminPrimitives.tsx:412` |
| c18 | med | admin-health | `Panel` description has no measure cap, so blurbs run ~1150px | `AdminPrimitives.tsx:105` vs `:78` |
| c20 | med | admin shared | Mobile Menu badge is `px-1.5` with no vertical padding, unlike the sidebar badge | `AdminSidebar.tsx:137` vs `:49` |
| c21 | med | admin-health, admin-overview | Borderless count chips sit on the same row as bordered `Pill`s | `AdminHealthPage.tsx:29`, `AdminOverviewPage.tsx:116` |
| c24 | med | admin-request-detail | Stretched grid pads the short Ticket panel to the tall Draft panel's height | `AdminDropRequestDetailPage.tsx:528` |
| c9 | med | admin shared | Three radius families, zero radius tokens: `rounded` (4px, the only one in the repo), `rounded-lg`, `rounded-full` | `AdminPrimitives.tsx:39,57,98,209,282,412` |
| c12 | med | admin-requests | Row action is a bare coral text link where sibling tables use a bordered control, and its cell omits `align="right"`. **Keep it a `<Link>`** (constraint 4) | `AdminDropRequestsPage.tsx:87,90` |
| c28 | low | admin-org-detail | Success notice is `rounded px-3 py-2` vs `ErrorNote`'s `rounded-lg p-3` | `AdminOrgDetailPage.tsx:196,202` |
| c29 | low | admin-overview | `items-baseline` drops the pill to the numeral's baseline | `AdminOverviewPage.tsx:45` |
| c30 | low | admin shared | The one elevated element uses stock `shadow-md`; it is the only shadow in the whole panel | `AdminPrimitives.tsx:296` |
| c25 | low | admin-drops | Hand-rolled chips copy the `FilterChips` class string verbatim. **Extract a shared `Chip` for classes only; keep these as `<button>`** (constraint 4) | `AdminDropsPage.tsx:121` vs `AdminPrimitives.tsx:209` |
