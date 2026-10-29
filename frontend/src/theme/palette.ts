/**
 * Pulse Black palette. Source: buzz-redesign.pen variables (yellow accent
 * #f6d32a, not the pink study). Tailwind reads this file via jiti.
 *
 * Legacy class names (`bg-buzz-cream`, `text-buzz-ink`, `bg-buzz-coral`, …)
 * stay valid so existing pages pick up the palette without per-page edits.
 * Their *values* now point at the pen. New code should prefer the pen names
 * (`yellow`, `fg`, `onAccent`, `inkRaised`).
 *
 * Naming collision to remember: the utility `text-buzz-ink` is body text, which
 * is the pen's *paper* (#f0f0f0). The pen's dark `ink` (#0b0b0b) is `cream`
 * (page), `onAccent` (text on yellow), and `dark`. `bg-buzz-paper` is the
 * raised card (`ink-raised`), not the light text color.
 */
export const pulse = {
  /** Pen `ink`. Page background. */
  ink: "#0b0b0b",
  inkRaised: "#121212",
  inkPop: "#161616",
  inkBtn: "#111111",
  /** Pen `paper`. Text and icons on ink. */
  fg: "#f0f0f0",
  white: "#ffffff",
  /** Text and icons on the yellow accent. Never use `fg` here (1.29:1). */
  onAccent: "#0b0b0b",
  yellow: "#f6d32a",
  yellowHover: "#e0be16",
  yellowFaded: "#f6d32a24",
  yellowLine: "#f6d32a40",
  /** paper at 60% / 52% / 30% / 9% / 8% / 4% over transparent. */
  paper60: "#f0f0f099",
  paper52: "#f0f0f085",
  paper30: "#f0f0f04d",
  paper09: "#f0f0f017",
  paper08: "#f0f0f014",
  paper04: "#f0f0f00a",
  greyMedia: "#dddddd",
  /** Light red for text and icons on ink. Solid fills use `dangerFill`. */
  dangerInk: "#ff7a7a",
  dangerFill: "#b91c1c",
  dangerFaded: "#ff7a7a1f",
  dangerLine: "#ff7a7a33",
  scrim: "#000000b3",
} as const;

export const tailwindThemeExtend = {
  colors: {
    buzz: {
      yellow: pulse.yellow,
      yellowHover: pulse.yellowHover,
      yellowFaded: pulse.yellowFaded,
      yellowLine: pulse.yellowLine,
      fg: pulse.fg,
      onAccent: pulse.onAccent,
      inkRaised: pulse.inkRaised,
      inkPop: pulse.inkPop,
      inkBtn: pulse.inkBtn,
      white: pulse.white,
      greyMedia: pulse.greyMedia,
      paper60: pulse.paper60,
      paper52: pulse.paper52,
      paper30: pulse.paper30,
      paper09: pulse.paper09,
      paper08: pulse.paper08,
      paper04: pulse.paper04,
      dangerInk: pulse.dangerInk,
      dangerFill: pulse.dangerFill,
      dangerFaded: pulse.dangerFaded,
      dangerLine: pulse.dangerLine,
      scrim: pulse.scrim,

      // --- legacy aliases (class names already used across the app) ---
      /** Was #F7366D. Now the yellow accent. */
      coral: pulse.yellow,
      coralLight: pulse.yellow,
      /** Was #FF005D. Now yellow hover. */
      coralDark: pulse.yellowHover,

      /** Was #fffcf5 page. Now pen ink. */
      cream: pulse.ink,
      /** Was #fdf3cb. Now yellow at 14% — warm wash on ink. */
      butter: pulse.yellowFaded,
      butterBright: pulse.yellow,

      /**
       * Was #ffffff (cards and text-on-coral). Now pen ink-raised, so
       * `bg-buzz-paper` is a dark card. Light text is `text-buzz-ink` / `fg`.
       * `text-buzz-paper` is dark; only correct on yellow, not on photos.
       */
      paper: pulse.inkRaised,

      /** Was #1c1917 body text. Now pen paper, so type stays readable on ink. */
      ink: pulse.fg,
      /** paper-60. 6.5:1 on ink. */
      inkMuted: pulse.paper60,
      /** paper-52. 5.2:1 on ink — the quietest text that still clears AA. */
      inkFaint: pulse.paper52,

      /** Hairline. Pen paper-09. */
      line: pulse.paper09,
      lineMid: pulse.paper09,

      neutral: pulse.inkPop,
      neutralHover: "#1c1c1c",
      neutralWash: "#101010",

      dark: pulse.ink,
      darkDeep: "#000000",
      /** Pair with `/60` or `/70`. The pen scrim is `buzz-scrim`. */
      overlay: "#000000",

      /**
       * Status text on ink. Green and amber are gone (POLISH): done reads as
       * paper, attention as yellow, errors as danger-ink. Solid destructive
       * fills use `dangerFill` (#b91c1c) with `fg` text — #121212 on that red
       * is only 2.9:1.
       */
      danger: pulse.dangerInk,
      dangerWash: pulse.dangerFaded,
      success: pulse.fg,
      successWash: pulse.paper08,
      successLine: "#f0f0f033",
      warn: pulse.yellow,
      warnWash: pulse.yellowFaded,
      warnLine: pulse.yellowLine,

      // Reserved. Not part of the Pulse Black palette; still used by nothing
      // in product UI today, kept so a stray class does not fall through to
      // an undefined color.
      blue: "#3b82f6",
      blueDark: "#1e3a8a",
      spectrumStart: "#facc15",
      spectrumMid: "#f97316",
      spectrumEnd: "#9333ea",
    },
  },
  boxShadow: {
    buzz: "0 8px 24px rgba(0, 0, 0, 0.28)",
    buzzLg: "0 24px 80px rgba(0, 0, 0, 0.55)",
  },
  dropShadow: {
    buzz: "0 1px 1px rgba(0, 0, 0, 0.45)",
  },
} as const;

/** Union of all `buzz-*` color keys for typed references outside Tailwind classes. */
export type BuzzColorToken = keyof typeof tailwindThemeExtend.colors.buzz;
