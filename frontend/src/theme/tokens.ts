/**
 * Semantic layout / type / surface tokens.
 *
 * The palette (`palette.ts`) and Tailwind config already owned color, radius,
 * shadow and z-index. What was missing — and what made the UI look unplanned —
 * is a named vocabulary for *rhythm, rank and surface*. Before this file, pages
 * picked spacing numbers by feel (`p-3` and `p-4` were both common, 36% of
 * spacing sat off any scale), invented their own heading sizes (9 text sizes,
 * `font-black` in 23 places), and hand-rolled card treatments (11 `rounded-*`
 * variants, 5 shadows).
 *
 * Rules for consumers:
 *  - Reach for a token by ROLE, never by number. If no role fits, the design
 *    needs a decision, not a new arbitrary value.
 *  - Weight is capped at `font-semibold` (600). Hierarchy comes from size and
 *    color, not from heavier ink.
 *  - Secondary text must be quieter than body text (`TEXT.meta`), never louder.
 *
 * `frontend/scripts/check-ui-primitives.sh` enforces the ban on the raw
 * utilities these tokens replace.
 */

/** Vertical rhythm between siblings. Four steps, chosen by relationship. */
export const STACK = {
  /** Label to helper text, icon to its caption — parts of one thing. */
  tight: "space-y-2",
  /** Sibling fields, sibling paragraphs — the default. */
  default: "space-y-4",
  /** Subsections inside one card or panel. */
  group: "space-y-6",
  /** Top-level page sections. */
  section: "space-y-8",
} as const;

/** Flex/grid gaps. Same four steps as `STACK` so rows and columns agree. */
export const GAP = {
  tight: "gap-2",
  default: "gap-4",
  group: "gap-6",
  section: "gap-8",
} as const;

/** Interior padding for surfaces. */
export const PAD = {
  /** Dense rows, chips, inset blocks. */
  tight: "p-3",
  /** Compact cards, table-adjacent panels, admin panel bodies. */
  default: "p-4",
  /** Standard card. */
  card: "p-6",
  /** Feature card, modal header, empty states. */
  roomy: "p-8",
} as const;

/** Marketing section band. One value so bands cannot drift apart. */
export const SECTION_Y = "py-16 md:py-20";

/**
 * Type scale: five ranks plus two support roles. A surface should use at most
 * three of these. `tracking-tight` on the large ranks keeps long headlines from
 * looking airy at display sizes.
 */
export const TEXT = {
  /** Marketing hero only — one per page, never in a portal. */
  display: "text-4xl font-semibold tracking-tight md:text-5xl",
  /** Page title. One per surface. */
  h1: "text-3xl font-semibold tracking-tight",
  /** Section title. */
  h2: "text-2xl font-semibold tracking-tight",
  /** Card, panel, or fieldset title. */
  h3: "text-lg font-semibold",
  /** Body copy in dense product UI. */
  body: "text-sm",
  /** Long-form reading: legal pages, marketing paragraphs. */
  bodyLong: "text-base leading-relaxed",
  /** Secondary / supporting text. Always quieter than body. */
  meta: "text-xs text-buzz-inkMuted",
  /** Eyebrow and chip label. 12px (`text-xs`); all-caps. Do not use `text-buzzMicro` here — see `cn.ts`. */
  micro: "text-xs uppercase",
  /** Metric numerals. Tabular so columns of numbers line up. */
  metric: "text-2xl font-semibold tabular-nums",
} as const;

/**
 * Surface treatments. Every card in the app should name one of these rather
 * than assembling its own radius + border + background + shadow.
 */
export const SURFACE = {
  /** Elevated card on the cream page background. */
  card: "rounded-buzzCard border border-buzz-lineMid bg-buzz-paper shadow-buzz",
  /** Flat card — use in grids, where stacked shadows read as noise. */
  cardFlat: "rounded-buzzCard border border-buzz-lineMid bg-buzz-paper",
  /** Warm card: drop feed tiles, marketing highlights. */
  cardWarm: "rounded-buzzCard border border-buzz-lineMid bg-buzz-butter",
  /** Portal / admin panel. */
  panel: "rounded-buzzCard border border-buzz-lineMid bg-buzz-paper",
  /** Inset block inside a card: read-only values, callouts, mock rows. */
  inset: "rounded-buzzControl border border-buzz-lineMid bg-buzz-cream",
  /** Modal shell. */
  modal: "rounded-buzzModal border border-buzz-lineMid bg-buzz-paper shadow-buzzLg",
} as const;

/**
 * Status tones as one border + fill + text triple.
 *
 * This replaces three divergent copies (`AdminPrimitives.TONE_CLASS`,
 * `BrandAggregateDashboardPage.toneClass`, `CampaignRow.STATUS_TONE`) and the
 * stock `green-*`/`amber-*`/`red-*`/`emerald-*` classes that leaked into a
 * dozen files.
 */
export const TONE = {
  neutral: "border-buzz-lineMid bg-buzz-cream text-buzz-inkMuted",
  success: "border-buzz-successLine bg-buzz-successWash text-buzz-success",
  warn: "border-buzz-warnLine bg-buzz-warnWash text-buzz-warn",
  danger: "border-buzz-dangerLine bg-buzz-dangerWash text-buzz-danger",
} as const;

export type Tone = keyof typeof TONE;
export type StackStep = keyof typeof STACK;
export type PadStep = keyof typeof PAD;
export type SurfaceKind = keyof typeof SURFACE;
