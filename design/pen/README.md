# BUZZ design system in pen

Every BUZZ brainstorm design has a pen file here. All the files use one set of tokens and one component set.

**/pulse-bee is the reference.** Its pen (`pulse-bee.pen`) is a faithful recreation of the live `/pulse-bee` route. The other pages were brought in line with it, including how it uses black. **`/pulse-bee` should get no React changes, or only very small ones.** The only allowed work there is swapping raw values for the shared token names, plus the type consolidation below (1–4 px size nudges). Layout, colors and copy must stay the same.

## Files

| File | What it holds |
|---|---|
| `buzz-design-system.pen` | All tokens and every component. A **Foundations** board covers palette, semantic paper/ink colors, black usage, type scale, spacing and radii. A **Components** board shows each component on paper and on ink. |
| `pulse-bee.pen` | `/pulse-bee` at desktop 1440 and mobile 390, plus the four "How it works" pinned states and the hover state for "Current drops". Only refactored onto tokens and the 8-step type scale. Against the original, the only changes are the 1–4 px type nudges and the logo strip, which now uses the repo's current local logos, the same as React. |
| `pulse-bee-orgs.pen` | `/pulse-bee/orgs` at 1440 and 390, with **more black** (see the page diffs below). |
| `pulse-bee-brands.pen` | `/pulse-bee/brands` at 1440 and 390, with **more black**. |
| `drop-editor.pen` | `/drop-editor`: admin, brand ("Request a drop"), date-range popover open, and drop-name edit. Refactored onto the shared tokens and type scale. Layout is unchanged; only the type sizes moved onto the shared steps. |
| `renders/*.png` | Exports of every board at 1x, reduced to 256 colors to keep the repo small. |
| `images/`, `fonts/` | The local images and Switzer 400/500 (with `Switzer-FFL.txt`) that the pens use. These are real files, not symlinks. |
| `tools/` | The Python that tokenised and generated these files. `tokens.py` is the canonical token list. `retype.py` moved the pens from the old 15-step type scale to the 8-step one. |

pen.dev can't share components across files, so each page file carries its own copy of the same components with the same ids. `buzz-design-system.pen` is the master copy.

`design/drop-editor/` is the earlier drop-editor pen together with its SPEC and README. It is **kept as is** for history, because its SPEC is still referenced. `design/pen/drop-editor.pen` is the tokenised copy to use from now on.

`/pulse2` shares its layout with `/pulse-bee`. Screenshot diffs at both widths differ only where the bee sits on the map, so `pulse-bee.pen` covers it. **`/pulse` has no pen yet.** It is the older predecessor and was out of scope for this pass.

## Tokens

The token names are the contract for React. Put them in one CSS file, for example `frontend/src/styles/buzz-tokens.css`, as `--buzz-<token>`, and have `.pulse2`, `.pulsebee-aud-*`, the drop editor and the lab read from it.

### Base colors

| Token | Value | Current CSS |
|---|---|---|
| ink | `#0b0b0b` | `--ink` (pulse, drop editor) |
| ink-raised | `#121212` | drop editor `--card` |
| ink-pop | `#161616` | drop editor `--pop` |
| ink-btn | `#111111` | the `#111` used for buttons and join text |
| paper | `#f0f0f0` | `--paper` |
| white | `#ffffff` | nav link text, white cards |
| grey-media | `#dddddd` | placeholder behind card media |
| yellow | `#f6d32a` | `--yellow`, drop editor `--y` |
| yellow-hover | `#e0be16` | `--yellow-hover` |
| yellow-faded | yellow at 14% | drop editor `--y-fade` |
| ink-64 / ink-30 / ink-16 / ink-08 | ink at 64 / 30 / 16 / 8% | `.64` opacity text / `--ink-30` / `rgba(17,17,17,.16)` hairlines / ghost fill |
| paper-60 / -52 / -30 / -09 / -08 / -04 | paper at those alphas | `--paper-60` / `--mut` / `--faint` / `--line` / `--s2` / `--s1` (drop editor) |
| success, success-wash | `#166534`, `#f0fdf4` | palette.ts |
| warn, warn-wash | `#b45309`, `#fffbeb` | palette.ts |
| danger, danger-wash | `#b91c1c`, `#fef2f2` | palette.ts |

### Semantic colors (theme axis `surface`: paper | ink)

| Token | paper | ink |
|---|---|---|
| surface | paper | ink |
| on-surface | ink | paper |
| on-surface-muted | ink-64 | paper-60 |
| on-surface-quiet | ink-30 | paper-30 |
| hairline | ink-16 | paper-09 |
| card-surface | white | ink-raised |
| pill-ghost-fill | ink-08 | paper-08 |

In React, use `[data-theme="paper"|"ink"]` on each section, which pulse-bee already sets, and point these vars at the right base color under each theme. Components only read the semantic tokens, so a section turns black by changing just its `data-theme`.

### Type (Switzer; 500 for display text, 400 for body; theme axis `device`: desktop 1440 | mobile 390)

Eight steps. They were consolidated from 15 near-duplicate sizes; every pen uses only these.

| Token | 1440 | 390 | Weight | Suggested CSS (linear between 390 and 1440) | Used for |
|---|---|---|---|---|---|
| type-display | 115 | 48 | 500, ls -0.04em | clamp(3rem, 1.445rem + 6.381vw, 7.1875rem) | footer "Want to join?" |
| type-title | 64 | 36 | 500, ls -0.045em | clamp(2.25rem, 1.6rem + 2.667vw, 4rem) | hero headline, Current drops, Questions, drop poster lockup |
| type-statement | 54 | 32 | 500, ls -0.05em | clamp(2rem, 1.489rem + 2.095vw, 3.375rem) | statement bands, goals, join halves, drop card brand, footer email (desktop) |
| type-h2 | 44 | 28 | 500, ls -0.04em | clamp(1.75rem, 1.379rem + 1.524vw, 2.75rem) | section heads, College network, stat values |
| type-h3 | 20 | 20 | 500, ls -0.01em | 1.25rem | card titles, FAQ questions, step captions, phone-mock titles, footer email (mobile) |
| type-body | 16 | 16 | 400 | 1rem | body, support lines, join support |
| type-small | 14 | 14 | 400/500 | 0.875rem | nav links, pills, buttons, drop-editor base |
| type-label | 12 | 12 | 400/500 | 0.75rem | kickers, small pills, footer meta, field labels, drop-editor micro labels |

Display line-height is 1 (0.95 for title). Body line-height is 1.4–1.5. Letter-spacing is in em, so it scales with the size.

**Old → new mapping** (desktop / mobile px; the change is new minus old)

| Old token or raw size | Old 1440 / 390 | New token | Change |
|---|---|---|---|
| type-display | 115.2 / 48 | type-display | −0.2 / 0 |
| type-title-xl | 66.24 / 38.4 | type-title | −2.2 / −2.4 |
| type-hero | 63.36 / 32.8 | type-title | +0.6 / +3.2 |
| type-title-lg | 56 / 21.6 | type-statement (desktop), type-h3 (mobile footer email) | −2 / −1.6 |
| type-statement | 54 / 36 | type-statement | 0 / −4 |
| type-join | 51.84 / 35.1 | type-statement | +2.2 / −3.1 |
| type-h2 | 43.2 / 32 | type-h2 | +0.8 / −4 |
| type-h3 | 20 / 20 | type-h3 | 0 |
| type-h4 | 18.72 / 17 | type-h3 | +1.3 / +3 |
| type-body-lg | 17 / 17 | type-body | −1 |
| type-body | 16 | type-body | 0 |
| type-small | 14 | type-small | 0 |
| type-label | 13 | type-label | −1 |
| type-micro | 12 | type-label | 0 |
| type-tiny | 11 | type-label | +1 |
| raw 15 (join pill labels, drop-editor buttons and month labels) | 15 | type-small | −1 |
| raw 18.4 / 22 / 23.04 (hidden chip value, drop-editor section title, phone-mock titles) | | type-h3 | +1.6 / −2 / −3 |
| raw 28 (mobile drop card brand) | – / 28 | type-h2 | 0 |
| raw 28 (notes board heading, desktop) | 28 | type-h3 | −8 (annotation only, not a page) |
| raw 40 (drop-editor stat value) | 40 | type-h2 | +4 |
| raw 68 (drop-editor poster lockup) | 68 | type-title | −4 |
| raw 30 (drop-editor small preview title) | 30 | type-h2 at mobile (28) | −2 |
| raw 9 (calendar "TODAY") | 9 | type-label | +3 (still fits the 44 cell) |

**Exceptions and why:**
- **Footer email on mobile uses type-h3 (20), not type-statement (32).** "hello@bringthebuzzover.com" is 26 characters, so it would overflow 358 at 32. On desktop it moves from 56 to 54.
- **The mobile scale squeezes title, statement and h2 to 36 / 32 / 28.** On mobile the old hero (32.8) was smaller than the old statement (36), so keeping their order needed a 3–4 px nudge there. The visible effect: on mobile, "Our platform makes it easy" now fits on one line instead of wrapping "easy".
- **The hover slide in `pulse-bee.pen` (o79EN) shows the brand at 55.08.** That is type-statement × 1.02, the hover transform; it is not a step.

### Space, radius, layout

- **Spacing:** `space-1…9` = 4, 8, 12, 16, 24, 32, 48, 64, 96. These are pulse's `--s1…--s9`.
- **Naming clash:** the drop editor's `--s1`/`--s2` are paper alphas, not spacing, and **must be renamed** to `paper-04`/`paper-08`.
- **Side and section padding:** `side` is 48 / 16, from `--side: clamp(1rem, 3.3vw, 3rem)`. `section-y` is 108 / 68, from `12svh`.
- **Radius:** `radius-pill` 999, `radius-card` 8 (cards and media), `radius-control` 8, `radius-field` 10 (drop editor), `radius-board` 16, `radius-phone` 32.
- **Content widths:** 1152 for cards, FAQ and nav. Section heads use a 704 measure and statements use 640.

### Where black is used (the rule taken from /pulse-bee)

- **Page rhythm:** photo hero with an ink scrim → paper bands → an ink or photo band → paper → ink footer.
- **No more than two paper bands in a row** on audience pages after the statement. `/pulse-bee` keeps its own order.
- **Yellow is only for:**
  - the primary pill
  - number badges
  - the bee tile
  - map pins and the drop editor's active and selected states
- **Buttons:**
  - On paper: `ink-btn` (`Pill / Dark`).
  - On ink: `Pill / Yellow` or `Pill / Ghost`, a 1px `on-surface` outline.

## Components

The ids are the same in every file.

| Component | id | Spec |
|---|---|---|
| Pill / Yellow | `uKtnH` | Height 40 (44 in hero), padding 0 16–21, yellow fill, ink text 14. |
| Pill / Dark | `XHmYw` | Height 36 (44 in join), ink-btn fill, paper text 13–15, optional chevron-right 16. |
| Pill / Ghost | `Ghost` | **New in React as a standard.** Height 44, padding 0 24, 1px on-surface stroke, text 14. Hover fills on-surface. Used for the goal chips on ink. |
| Button / Arrow | `ArrowB` | 40 circle with a 1px on-surface stroke and an 18 chevron. Carousel prev/next; prev is at 0.28 opacity when disabled. |
| NavBar / NavBar / Mobile | `H3d268` / `YSw6B` | Floating glass bar: ink at 44%, 1px white-3% stroke. Width 1152 × 66, or 374 × 58 on mobile. The active link has a 1px underline. |
| Section / Head | `SecHd` | Centered `type-h2` title plus a `type-body` muted support line, 16 apart, 704 wide, 48 above the content. |
| Card / Numbered / Photo | `CardPh` | Media 16:15 (4:3 on mobile), radius 8, grey-media under a cover image, and a yellow 32 badge with ink text 14/500 at 16,16. Title `type-h3` 24 below the media; body `type-body` muted 8 below the title. Three across with a 24 gap at 1152, stacked with a 32 gap on mobile. |
| Card / Numbered / Mark | `CardMk` | Same as Photo, but the media is a yellow fill with the bee at 34% and the badge is ink with yellow text. |
| FAQ / Item, FAQ / Item / Open | `FaqCl` / `FaqOp` | 1px hairline on top, then a 64 row with the question in `type-h3` 500 and a 14 plus icon (an x when open). The answer is `type-body` muted, max 540 (60ch), with 24 below. The list ends with a hairline. Desktop layout is the title column at 1fr ("Questions", `type-title-xl`) and the list at 2fr, with a 32 gap. |
| DropCard | `N4ul60` | Current drops slide. |
| FooterColumn | `RArr7` | Footer link column. |
| LogoItem / MapPin | `lM2vX` / `QFtyV` | Marquee logo (48) and campus pin. |
| App / Field, App / Button, App / Chip | `QhHN7`, `V6GNvM`, `Brjmq` | The phone mock in "How it works". |
| Drop-editor set | `O4h20f` Pill, `vTXYD` Chip, `hN5sG` Campus chip, `e0Bt4` Section header, `xNCzN` Time row, `CCoIO` Detail row, `e5JjE` Stat, `cw9tO` Toggle, `I3tYj` Date range popover | All on ink, in the drop-editor sizes. |

Sections that are whole bands (Hero, Statement, College network, How it works, Current drops, Join, Footer) are shared by copying the `/pulse-bee` frames. The React parts that already exist (`AudienceHero`, `Statement`, `NumberedCards`, `Faq`, `JoinBlock`, `DropsCarousel`, `LogoRow`) are the React equivalents.

## Changes React needs, page by page

The React work is mostly naming and themes, not layout.

### /pulse-bee: no layout change, type sizes only
- Move every font-size in `pulseBee.css` / `pulse2.css` onto the eight `--buzz-type-*` steps above (see the mapping). On desktop these are 0–2 px nudges. On mobile, title/statement/h2 move by up to 4 px and the footer email goes to 20.
- Nothing else changes: colors, spacing, sections and copy stay as they are. `renders/pulse-bee-*.png` show the result.

### /pulse-bee/orgs (`renders/orgs-*.png`)
1. Set **"Partner with brands" (`#gets`) to `data-theme="ink"`**:
   - The section background goes ink.
   - The head title goes to paper and its support line to paper-60.
   - Card h3 goes to paper and card body to paper-60.
   - Card media and badges stay as they are.
2. Set **the FAQ to `data-theme="ink"`**. `Faq` needs a `theme` prop. On ink:
   - Hairlines become paper-09 instead of `rgba(17,17,17,.16)`.
   - Text becomes paper and answers paper-60.
3. Everything else stays the same: hero, statement, how-it-works, current drops, join, footer.
4. The resulting order is photo hero → paper statement → **ink** partner cards → paper how → paper drops → **ink** FAQ → paper join → ink footer.

### /pulse-bee/brands (`renders/brands-*.png`)
1. Set **the FAQ to `data-theme="ink"`**, the same change as on orgs.
2. Keep the existing ink goals band.
3. The resulting order is photo hero → paper statement → paper how cards → **ink** goals → paper network → **ink** FAQ → paper join → ink footer.
4. **Bug to fix:** at 390 the College-network logo marquee stacks vertically on `/pulse-bee/brands`. It should be the horizontal marquee, as on `/pulse-bee`. The pen shows the correct version.
5. Goal chips use `Pill / Ghost`. This already matches `.pulse2-ghost`.

### Shared audience CSS (`pulseBeeAudience.css`)
- Replace the hard-coded `rgba(17,17,17,.16)` and `opacity: .64` with `hairline` and `on-surface-muted`. That way the cards and FAQ work on both themes.
- The FAQ question size becomes `type-h3` (20, was 18.72 / 17). Join support copy becomes `type-body` (16, was 17).

### /drop-editor (`renders/drop-editor-*.png`)
- Layout stays as it is. Type moves onto the shared steps: base 13/12/11 labels → `type-label` 12. 15 buttons and month labels → `type-small` 14. 22 section titles → `type-h3` 20. The 40 stat → `type-h2` 44. The 68 poster lockup → `type-title` 64. The 30 preview title → 28. "TODAY" 9 → 12.
- Rename its CSS vars to the shared tokens:

  | Current | New |
  |---|---|
  | `--y` | `yellow` |
  | `--y-fade` | `yellow-faded` |
  | `--mut` | `paper-52` |
  | `--faint` | `paper-30` |
  | `--line` | `paper-09` |
  | `--s1` | `paper-04` |
  | `--s2` | `paper-08` |
  | `--card` | `ink-raised` |
  | `--pop` | `ink-pop` |

- The `--s1`/`--s2` rename is required so they stop clashing with the spacing tokens.

### Lab directory
- Already uses ink, yellow and Switzer.
- Map its stray `#141414` to `ink-raised` and its `#fffcf5` (the old cream) to `paper` or `white`.

### /pulse, /pulse2
- **/pulse2:** equal to `/pulse-bee`, so nothing to do.
- **/pulse:** no pen yet. Leave it.

## Rules for any new design
- Use only the tokens above and the components from `buzz-design-system.pen`.
- Use real copy from the repo and local images only. No invented numbers, prices or timelines.
- Use real fonts and images: Switzer 400/500 only, and files rather than symlinks under `design/pen/`.
