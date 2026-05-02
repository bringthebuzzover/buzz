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

      // Links & verified badge (2)
      blue: "#3b82f6",
      blueDark: "#1e3a8a",

      // Mock IG gradient (3)
      spectrumStart: "#facc15",
      spectrumMid: "#f97316",
      spectrumEnd: "#9333ea",

      // Waitlist block (3)
      waitlistInk: "#0e2a47",
      waitlistRose: "#e6005c",
      waitlistPink: "#ff005d",
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
