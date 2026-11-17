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
  /** Dialog panel. Keeps the centering translate inside the keyframes. Supports Radix open/close states. */
  modal:
    "data-[state=open]:animate-buzz-modal data-[state=closed]:animate-buzz-modal-exit motion-reduce:animate-none",
  /** Scrim. */
  scrim:
    "data-[state=open]:animate-buzz-fade data-[state=closed]:animate-buzz-fade-exit motion-reduce:animate-none",
  /** Click/tap scale feedback on interactive buttons and pills (active:scale-95). */
  press:
    "cursor-pointer transition-transform duration-150 active:scale-95 motion-reduce:transform-none motion-reduce:transition-none",
  /** Subtle interactive link with muted-to-primary color fade and press feedback. */
  interactiveLink:
    "text-muted hover:text-primary transition-all duration-150 inline-block active:scale-95 motion-reduce:active:scale-100 cursor-pointer",
  /** Animated arrow icon sliding right on group hover or group focus. */
  hoverArrow:
    "transition-transform duration-300 group-hover:translate-x-1.5 group-focus-within:translate-x-1.5 motion-reduce:transform-none motion-reduce:transition-none",
  /** Accordion toggle plus/chevron indicator rotating 45 degrees when open. */
  accordionIndicator:
    "transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none",
  /** Nav link with sliding animated bottom underline indicator. */
  navLink:
    "relative whitespace-nowrap text-sm cursor-pointer transition-all duration-150 active:scale-95 motion-reduce:active:scale-100 motion-reduce:transition-none after:absolute after:inset-x-0 after:-bottom-2 after:h-px after:origin-left after:bg-current after:content-[''] hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-safe:after:transition-transform motion-safe:after:duration-[180ms]",
  /** Interactive filter chip / pill transition. */
  chip:
    "cursor-pointer rounded-full transition-all duration-200 active:scale-95 motion-reduce:transition-none",
  /** Smooth carousel track transition. */
  carouselTrack:
    "transition-transform duration-500 motion-reduce:transition-none",
  /** Standard fast color transition. */
  transitionColors:
    "transition-colors duration-150 motion-reduce:transition-none",
} as const;

export type MotionKind = keyof typeof MOTION;
