import { MOTION, type MotionKind } from "./motion";

describe("MOTION tokens", () => {
  it("defines standard motion tokens with appropriate durations and states", () => {
    expect(MOTION.publicEnter).toBe("animate-buzz-rise motion-reduce:animate-none");
    expect(MOTION.appEnter).toBe("animate-buzz-fade motion-reduce:animate-none");
    expect(MOTION.float).toBe("animate-buzz-float motion-reduce:animate-none");
    expect(MOTION.hoverLift).toContain("buzz-hover-lift");
    expect(MOTION.modal).toContain("data-[state=open]:animate-buzz-modal");
    expect(MOTION.modal).toContain("data-[state=closed]:animate-buzz-modal-exit");
    expect(MOTION.scrim).toContain("data-[state=open]:animate-buzz-fade");
    expect(MOTION.scrim).toContain("data-[state=closed]:animate-buzz-fade-exit");
  });

  it("includes interactive tokens for click, tap, and hover effects", () => {
    expect(MOTION.press).toContain("active:scale-95");
    expect(MOTION.press).toContain("duration-150");

    expect(MOTION.interactiveLink).toContain("text-muted");
    expect(MOTION.interactiveLink).toContain("hover:text-primary");
    expect(MOTION.interactiveLink).toContain("active:scale-95");

    expect(MOTION.hoverArrow).toContain("group-hover:translate-x-1.5");
    expect(MOTION.hoverArrow).toContain("duration-300");

    expect(MOTION.accordionIndicator).toContain("group-open:rotate-45");
    expect(MOTION.accordionIndicator).toContain("duration-300");

    expect(MOTION.navLink).toContain("after:scale-x-100");
    expect(MOTION.navLink).toContain("duration-[180ms]");

    expect(MOTION.chip).toContain("rounded-full");
    expect(MOTION.chip).toContain("active:scale-95");

    expect(MOTION.carouselTrack).toContain("duration-500");
    expect(MOTION.transitionColors).toContain("duration-150");
  });

  it("respects prefers-reduced-motion across all animated tokens", () => {
    const motionTokens = Object.entries(MOTION) as [MotionKind, string][];

    for (const [key, value] of motionTokens) {
      // Every motion token must include either motion-reduce:* or motion-safe:*
      const hasAccessibilityGuard =
        value.includes("motion-reduce:") || value.includes("motion-safe:");
      expect({ key, hasAccessibilityGuard }).toEqual({
        key,
        hasAccessibilityGuard: true,
      });
    }
  });
});
