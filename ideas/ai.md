---
id: ai
title: AI at Buzz — platform bets
status: exploring
updated: 2026-08-11
---

# AI at Buzz

Brainstorm captured from product discussion (2026-08-11). Not committed
behavior. Buzz’s real asset is the closed loop **campus orgs × branded drops ×
attributed Instagram posts × engagement over time** — AI should amplify that
loop, not decorate the UI with a generic chatbot.

**Thesis:** Buzz AI ≈ **portfolio matching + authenticity + operator
compression**, trained on apply → finalize → post link → metrics → next drop.

## Do not start here

- Generic “Ask Buzz” chat over docs.
- Inventing engagement or replacing Instagram metrics.
- Fully autonomous accept/deny with no human override (trust / fairness risk
  with student orgs).

---

## High-leverage plays

### 1. Selection co-finalizer (matching)

PRODUCT §5.3.1 already notes a future matching algorithm. Brands’ hardest job
after `apply_close_at` is batch finalize under capacity + unit budget.

- Not a generic “fit score” list — a **portfolio optimizer**: campus diversity,
  org category mix, expected engagement, authenticity risk, unit budget.
- Output a **proposed slate** brands can accept/tweak in one click.
- Learn from prior drops (which org types / campuses over-index for a category).

### 2. Authenticity as a product edge

Buzz sells organic student-led reach, not cold ads.

- Caption/voice mismatch (“reads like brand copy”).
- Soft fraud / low-effort signals (recycled UGC, odd engagement patterns).
- Brief → chapter-native draft posts (tone, constraints) so orgs post faster and
  brands get better UGC.
- Optional anti-feature: rewrite brand briefs into student-safe constraints;
  refuse corporate voice that would kill authenticity.

### 3. Admin / ops compression

Admins sit in the critical path (org approval, drop tracker, exceptions).

- Org onboarding triage from IG + campus + history → approve / deny / escalate
  with reasons.
- Drop-request stage suggestions from tracker/email noise.
- Exception routing (shipping stuck, post won’t link, dead IG token) →
  diagnose + draft the right email.
- Longer bet: internal agent watches windows, finalize deadlines, missing
  tracking #s, unlinked posts, dead tokens — nudges humans only on exceptions.

### 4. Org PLG assist (Drop Feed / apply / link)

- Personalized Drop Feed (“strong match; closes in 6h”).
- Application assist: short pitch from IG history.
- Post-linking assist: which media belongs to which campaign (attribution pain).

### 5. Metrics → narrative (brands renew on proof)

- Auto drop recaps: campuses, best posts, CPE, next-drop recommendations.
- Campus / category performance patterns across drops.
- UGC curator: top assets for a brand deck + rights/consent flags when known.

---

## Throw-the-box bets

| Bet | Note |
| --- | --- |
| Synthetic campus focus groups | Pre-flight brief/creative against past org-type engagement before a drop ships. |
| Campus graph (not CRM) | Embed orgs by university, category, content style, reliability; matching as graph cover. |
| Soft prediction / pricing | Expected engagement / CPE ranges before finalize → eventual pricing power. |
| Drop-running agent | Ops OS with a brain (see §3). |

---

## Linked content enrichment (transcript / describe / rate)

**Idea:** For each **linked** post/Reel, produce transcript + description +
brief-fit rating so brands can search/browse UGC without watching everything,
and so later matching has content features.

### Meta reality (as of 2026-08)

- Instagram Graph **does not** expose a Reel transcript / closed-captions field.
- Buzz already stores `caption`, `media_url`, `thumbnail_url`, insights
  (`backend/app/services/instagram.py`, `social_posts`).
- `media_url` is **often omitted** when the Reel uses copyrighted music — so
  “download and watch” fails for a large campus slice; fall back to caption +
  thumbnail / OCR of burned-in text.
- CDN `media_url`s are short-lived — enrich at link time; persist **derived**
  text, not necessarily the video forever.

### Suggested pipeline

Post-enrichment job on link (retry if media URL appears later):

1. Caption-only → tags, mention check, text authenticity.
2. Thumbnail / image → visual describe, product presence, on-screen OCR.
3. Video `media_url` present → ASR transcript + multimodal watch.
4. Persist structured fields, e.g. `transcript`, `summary`, `tags`,
   `brief_fit_score`, `authenticity_flags`, `product_visible`,
   `media_unavailable` / `copyright_blocked`.

Prefer owned-media via org token when Meta allows it. Third-party permalink
scrapers are a last resort (ToS / fragility).

### What “rate” should mean

Score against the **drop brief**, not a vanity 1–10:

- Brand / hashtag / product mention?
- Student-native vs corporate voice?
- Product on camera?
- Brief compliance (claims, tone, CTA)?
- Searchable UGC blurb for the library.

### Constraints

- Enrich **linked** posts only (cost control).
- Derived creative text is content-adjacent → wipe on org erase like caption /
  media (PRODUCT KPI retention is numeric stats, not creative text).
- Open product fork: brand-only enrichment in UGC library vs also show orgs a
  “how this reads for the brand” preview before link.

### Plausible v0

Caption + thumbnail enrichment for all linked posts; upgrade to ASR/multimodal
when `media_url` exists; surface search/filter in brand UGC library.

---

## Possible promotion path

When something graduates from brainstorm:

1. Explicit PRODUCT / UX decision (hard stop).
2. Spec the slice in [`PRODUCT.md`](../PRODUCT.md) (or a scoped PR that edits it).
3. Implement via normal ship / gap-cluster workflow — not from this file alone.
4. Set frontmatter `status: promoted` and link the PRODUCT § or gap/PR.

Related (UI tooling, not platform AI): [`paper-ui.md`](paper-ui.md).
