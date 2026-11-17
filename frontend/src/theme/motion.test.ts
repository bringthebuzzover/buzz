import { MOTION, type MotionKind } from "./motion";
import { cn } from "./cn";

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
    expect(MOTION.press).toContain("transition-all");

    expect(MOTION.interactiveLink).toContain("text-muted");
    expect(MOTION.interactiveLink).toContain("hover:text-primary");
    expect(MOTION.interactiveLink).toContain("active:scale-95");
    expect(MOTION.interactiveLink).not.toContain("inline-block");

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

  it("respects prefers-reduced-motion across all animated and scaled tokens", () => {
    const motionTokens = Object.entries(MOTION) as [MotionKind, string][];

    for (const [key, value] of motionTokens) {
      // 1. Every motion token must include either motion-reduce:* or motion-safe:*
      const hasAccessibilityGuard =
        value.includes("motion-reduce:") || value.includes("motion-safe:");
      expect({ key, hasAccessibilityGuard }).toEqual({
        key,
        hasAccessibilityGuard: true,
      });

      // 2. Any active:scale transition must neutralize scale under reduced motion
      if (value.includes("active:scale-")) {
        expect(value).toContain("motion-reduce:active:scale-100");
      }

      // 3. Any transition must neutralize under reduced motion unless motion-safe scoped
      if (value.includes("transition-") && !value.includes("motion-safe:")) {
        expect(value).toContain("motion-reduce:transition-none");
      }
    }
  });

  it("does not conflict with display layout when merged via cn/tailwind-merge", () => {
    const mergedFlex = cn(
      "inline-flex items-center gap-2 rounded-full text-sm",
      MOTION.interactiveLink,
    );
    expect(mergedFlex).toContain("inline-flex");
    expect(mergedFlex).toContain("items-center");
    expect(mergedFlex).toContain("gap-2");
    expect(mergedFlex).not.toContain("inline-block");

    const mergedBlock = cn(
      "text-sm inline-block",
      MOTION.interactiveLink,
    );
    expect(mergedBlock).toContain("inline-block");
  });
});
