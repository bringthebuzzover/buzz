/**
 * Buzz brand palette consumed by `tailwind.config.js` (via jiti) as `theme.extend`.
 * Maps to Tailwind utilities like `bg-buzz-coral` and `shadow-buzzLg`.
 * Hue families are capped at three steps; duplicate hex values use a single token (e.g. `paper`).
 */
export const tailwindThemeExtend = {
  colors: {
    buzz: {
      // Coral (3)
      coral: "#F7366D",
      coralLight: "#FD6581",
      coralDark: "#FF005D",

      // Warm surfaces (3)
      cream: "#fffcf5",
      butter: "#fdf3cb",
      butterBright: "#fef08a",

      /** Cards, inputs, and text on dark backgrounds (single #fff) */
      paper: "#ffffff",

      // Type (3)
      ink: "#1c1917",
      inkMuted: "#57534e",
      inkFaint: "#a8a29e",

      // Warm chrome / borders (2)
      line: "#fef9c3",
      lineMid: "#fde68a",

      // Neutral panels (3)
      neutral: "#f5f5f4",
      neutralHover: "#e7e5e4",
      neutralWash: "#fafaf9",

      // Dark UI (3)
      dark: "#171717",
      darkDeep: "#0a0a0a",
      overlay: "#000000",

      // Semantic status (mapped from the stock Tailwind red/green/amber we used).
      // Each tone is a triple: `X` = text/icon, `XWash` = fill, `XLine` = border.
      // The Line steps exist so status panels stop reaching for `*-300`.
      danger: "#b91c1c",
      dangerWash: "#fef2f2",
      dangerLine: "#fca5a5",
      success: "#166534",
      successWash: "#f0fdf4",
      successLine: "#86efac",
      warn: "#b45309",
      warnWash: "#fffbeb",
      warnLine: "#fcd34d",

      // Links & verified badge (2) — reserved; prefer ink/coral in product UI
      blue: "#3b82f6",
      blueDark: "#1e3a8a",

      // Mock IG gradient (3) — reserved for tour/marketing mocks
      spectrumStart: "#facc15",
      spectrumMid: "#f97316",
      spectrumEnd: "#9333ea",
    },
  },
  boxShadow: {
    buzz: "0 20px 60px rgba(28, 25, 23, 0.12)",
    buzzLg: "0 25px 50px -12px rgba(28, 25, 23, 0.25)",
  },
  dropShadow: {
    buzz: "0 1px 1.5px rgba(28, 25, 23, 0.12)",
  },
} as const;

/** Union of all `buzz-*` color keys for typed references outside Tailwind classes. */
export type BuzzColorToken = keyof typeof tailwindThemeExtend.colors.buzz;
