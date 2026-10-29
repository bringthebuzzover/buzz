/**
 * Semantic layout / type / surface tokens.
 *
 * Color lives in `palette.ts`. This file names rhythm, rank, and surface so
 * pages don't invent their own.
 *
 * Type scale is the pen's eight steps (115 / 64 / 54 / 44 / 20 / 16 / 14 / 12),
 * weight 500 on display ranks and 400 on body. `h1` is the pen's page title
 * (44px, `type-h2`), not the marketing display, so portal titles don't become
 * posters. Marketing display / title / statement are here for later page PRs.
 *
 * Pen spacing is 4, 8, 12, 16, 24, 32, 48, 64, 96. Tailwind's default scale
 * already has those except that its `5` is 20px and the pen's space-5 is 24px
 * (Tailwind `6`). `STACK` / `GAP` use 8 / 16 / 24 / 32, which match.
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

/**
 * Marketing section band. Pen `section-y`: 68px mobile, 108px desktop.
 */
export const SECTION_Y = "py-[68px] md:py-[108px]";

/**
 * Type scale. A surface should use at most three ranks. Large ranks carry the
 * tracking in the font-size token (`buzzDisplay`, `buzzH2`, …).
 */
export const TEXT = {
  /** Marketing hero only — one per page, never in a portal. 48 / 115. */
  display:
    "text-[48px] font-medium leading-[0.95] tracking-tight md:text-buzzDisplay",
  /** Marketing title. 36 / 64. */
  title: "text-[36px] font-medium leading-tight tracking-tight md:text-buzzTitle",
  /** Marketing statement. 32 / 54. */
  statement:
    "text-[32px] font-medium leading-tight tracking-tight md:text-buzzStatement",
  /** Page title. Pen type-h2: 28 / 44. */
  h1: "text-[28px] font-medium leading-[1.1] tracking-tight md:text-buzzH2",
  /** Section title. */
  h2: "text-buzzH3 font-medium md:text-[28px] md:leading-tight",
  /** Card, panel, or fieldset title. Pen type-h3, 20px. */
  h3: "text-buzzH3 font-medium",
  /** Body copy in dense product UI. Pen type-small, 14px. */
  body: "text-buzzSmall",
  /** Long-form reading: legal pages, marketing paragraphs. Pen type-body, 16px. */
  bodyLong: "text-buzzBody leading-relaxed",
  /** Secondary / supporting text. Always quieter than body. */
  meta: "text-buzzLabel text-buzz-inkMuted",
  /** Eyebrow and chip label. 12px. Sentence case — the pen badges aren't caps. */
  micro: "text-xs",
  /** Metric numerals. Tabular so columns of numbers line up. */
  metric: "text-buzzH3 font-medium tabular-nums",
} as const;

/**
 * Surface treatments. Every card in the app should name one of these rather
 * than assembling its own radius + border + background + shadow.
 * Panels are flat: hairline on ink-raised. The pen doesn't use a drop shadow
 * on cards; `shadow-buzzLg` stays on the modal only.
 */
export const SURFACE = {
  /** Raised card on the ink page. */
  card: "rounded-buzzCard border border-buzz-line bg-buzz-paper",
  /** Flat card — same ink-raised fill, for grids. */
  cardFlat: "rounded-buzzCard border border-buzz-line bg-buzz-paper",
  /** Yellow-faded card: highlights, selected tiles. */
  cardWarm: "rounded-buzzCard border border-buzz-yellowLine bg-buzz-butter",
  /** Portal / admin panel. Pen radius-board. */
  panel: "rounded-buzzCard border border-buzz-line bg-buzz-inkRaised",
  /** Inset block inside a card. */
  inset: "rounded-buzzField border border-buzz-line bg-buzz-paper04",
  /** Modal shell. Pen ink-pop, radius-board. */
  modal: "rounded-buzzModal border border-buzz-line bg-buzz-inkPop shadow-buzzLg",
} as const;

/**
 * Status tones. POLISH: yellow fill is live (see `Chip accent`), yellow
 * outline is attention, white is done, grey is closed, red is errors only.
 * Green and amber washes are not in the palette.
 */
export const TONE = {
  neutral: "border-buzz-line bg-buzz-paper08 text-buzz-inkMuted",
  /** Done / active: paper fill, ink label. */
  success: "border-transparent bg-buzz-fg text-buzz-onAccent",
  /** Needs attention: yellow outline and yellow label. */
  warn: "border-buzz-yellowLine bg-buzz-yellowFaded text-buzz-yellow",
  danger: "border-buzz-dangerLine bg-buzz-dangerFaded text-buzz-danger",
} as const;

export type Tone = keyof typeof TONE;
export type StackStep = keyof typeof STACK;
export type PadStep = keyof typeof PAD;
export type SurfaceKind = keyof typeof SURFACE;
