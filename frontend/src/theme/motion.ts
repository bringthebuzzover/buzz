/**
 * Motion utilities. Public marketing pages use the richer set; app pages use
 * the short fade. Both stop under `prefers-reduced-motion` (the classes include
 * `motion-reduce:*`, and `index.css` kills the keyframes outright).
 *
 * Durations are the pen's motion notes: fade-up 24px / 600ms on marketing,
 * fade 220ms in the app, modal rise 12px / 220ms, card hover scale 1.03 / 240ms.
 * Apply these classes in later page PRs — nothing here restyles a route.
 */
export const MOTION = {
  /** Marketing entrance. Fade up 24px, 600ms. */
  publicEnter: "animate-buzz-rise motion-reduce:animate-none",
  /** App entrance. Opacity only, 220ms. */
  appEnter: "animate-buzz-fade motion-reduce:animate-none",
  /** Decorative bee. Marketing and status surfaces, not admin. */
  float: "animate-buzz-float motion-reduce:animate-none",
  /** Drop-card hover. Marketing only. */
  hoverLift:
    "buzz-hover-lift transition-transform duration-[240ms] ease-out hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100",
  /** Dialog panel. Keeps the centering translate inside the keyframes. */
  modal: "animate-buzz-modal motion-reduce:animate-none",
  /** Scrim. */
  scrim: "animate-buzz-fade motion-reduce:animate-none",
} as const;

export type MotionKind = keyof typeof MOTION;
