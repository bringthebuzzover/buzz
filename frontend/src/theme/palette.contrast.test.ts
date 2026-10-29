/**
 * WCAG 2.x contrast for the Pulse Black pairs that actually carry text.
 * Yellow (#f6d32a) fails on white and on paper; ink type on yellow passes.
 */
import { buttonVariants } from "../components/forms/controls";
import { chipOnMediaClass } from "../components/ui/Chip";
import { MOTION } from "./motion";
import { pulse, tailwindThemeExtend } from "./palette";

function channel(hex: string, index: number): number {
  const n = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [0, 1, 2].map((i) => channel(hex, i));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

/** 8-digit #RRGGBBAA blended over an opaque background. */
function composite(overlay: string, background: string): string {
  const alpha = parseInt(overlay.slice(7, 9), 16) / 255;
  const mix = (index: number) => {
    const o = parseInt(overlay.slice(1 + index * 2, 3 + index * 2), 16);
    const b = parseInt(background.slice(1 + index * 2, 3 + index * 2), 16);
    return Math.round(o * alpha + b * (1 - alpha));
  };
  return `#${[0, 1, 2].map((i) => mix(i).toString(16).padStart(2, "0")).join("")}`;
}

const AA = 4.5;

describe("Pulse Black contrast", () => {
  it("keeps text on yellow and yellow on ink at AA", () => {
    expect(contrast(pulse.onAccent, pulse.yellow)).toBeGreaterThanOrEqual(AA);
    expect(contrast(pulse.inkRaised, pulse.yellow)).toBeGreaterThanOrEqual(AA);
    expect(contrast(pulse.yellow, pulse.ink)).toBeGreaterThanOrEqual(AA);
    expect(contrast(pulse.yellow, pulse.inkRaised)).toBeGreaterThanOrEqual(AA);
    expect(contrast(pulse.fg, pulse.ink)).toBeGreaterThanOrEqual(AA);
    expect(contrast(pulse.fg, pulse.inkRaised)).toBeGreaterThanOrEqual(AA);
    expect(contrast(pulse.fg, pulse.dangerFill)).toBeGreaterThanOrEqual(AA);
    expect(contrast(pulse.dangerInk, pulse.ink)).toBeGreaterThanOrEqual(AA);
    expect(contrast(pulse.onAccent, pulse.fg)).toBeGreaterThanOrEqual(AA);
    expect(contrast(pulse.onAccent, pulse.dangerInk)).toBeGreaterThanOrEqual(AA);
    expect(contrast(pulse.dangerFill, pulse.fg)).toBeGreaterThanOrEqual(AA);
  });

  it("rejects the yellow pairings that fail AA", () => {
    expect(contrast(pulse.fg, pulse.yellow)).toBeLessThan(3);
    expect(contrast(pulse.yellow, pulse.white)).toBeLessThan(3);
    expect(contrast(pulse.yellow, pulse.fg)).toBeLessThan(3);
    expect(contrast(pulse.inkRaised, pulse.dangerFill)).toBeLessThan(3);
  });

  it("keeps quiet text and yellow-on-wash above AA, and idle dots below it", () => {
    const mutedOnInk = composite(pulse.paper60, pulse.ink);
    const faintOnInk = composite(pulse.paper52, pulse.ink);
    const idleOnInk = composite(pulse.paper30, pulse.ink);
    const washOnInk = composite(pulse.yellowFaded, pulse.ink);
    const washOnCard = composite(pulse.yellowFaded, pulse.inkRaised);

    expect(contrast(mutedOnInk, pulse.ink)).toBeGreaterThanOrEqual(AA);
    expect(contrast(faintOnInk, pulse.ink)).toBeGreaterThanOrEqual(AA);
    expect(contrast(pulse.yellow, washOnInk)).toBeGreaterThanOrEqual(AA);
    expect(contrast(pulse.yellow, washOnCard)).toBeGreaterThanOrEqual(AA);
    // A selected row on the wash uses muted, not quiet, for its secondary text.
    const mutedOnWash = composite(pulse.paper60, washOnCard);
    expect(contrast(mutedOnWash, washOnCard)).toBeGreaterThanOrEqual(AA);
    // paper-30 is the loader's idle dots, not a text color.
    expect(contrast(idleOnInk, pulse.ink)).toBeLessThan(AA);
  });

  it("points the legacy class names at the pen", () => {
    const buzz = tailwindThemeExtend.colors.buzz;
    expect(buzz.coral).toBe(pulse.yellow);
    expect(buzz.cream).toBe(pulse.ink);
    expect(buzz.paper).toBe(pulse.inkRaised);
    expect(buzz.ink).toBe(pulse.fg);
    expect(buzz.danger).toBe(pulse.dangerInk);
    expect(buzz.dangerFill).toBe("#b91c1c");
    expect(buzz.yellow).toBe("#f6d32a");
  });

  it("puts ink type on the yellow button and paper type on the danger fill", () => {
    const primary = buttonVariants({ variant: "primary" });
    expect(primary).toContain("bg-accent");
    expect(primary).toContain("text-on-accent");
    expect(primary).not.toMatch(/\btext-primary\b/);
    expect(primary).not.toMatch(/\btext-buzz-fg\b/);
    expect(primary).not.toMatch(/\btext-buzz-ink\b/);

    const danger = buttonVariants({ variant: "danger" });
    expect(danger).toContain("bg-buzz-dangerFill");
    expect(danger).toContain("text-primary");
    expect(danger).toContain("hover:text-on-accent");
  });

  it("keeps the focus ring, media chips, secondary edge, and modal type", () => {
    const primary = buttonVariants({ variant: "primary" });
    expect(primary).toContain("ring-buzz-yellow");
    expect(primary).toContain("ring-offset-2");
    expect(primary).toContain("ring-offset-page");
    expect(primary).not.toContain("ring-buzz-yellow/40");
    expect(contrast(pulse.yellow, pulse.ink)).toBeGreaterThanOrEqual(3);

    // Ink at 80% over white is the worst photograph behind a status chip.
    const media = composite("#0b0b0bcc", pulse.white);
    expect(chipOnMediaClass).toContain("bg-page/80");
    expect(chipOnMediaClass).toContain("text-primary");
    expect(chipOnMediaClass).toContain("border-line");
    expect(chipOnMediaClass).toContain("backdrop-blur");
    expect(contrast(pulse.fg, media)).toBeGreaterThanOrEqual(AA);

    const secondary = buttonVariants({ variant: "secondary" });
    expect(secondary).toContain("border-line");
    const edge = composite(pulse.paper09, pulse.ink);
    // paper-09 is the pen hairline (about 1.2:1 on ink). The label on the
    // dark pill is the pair that has to clear AA.
    expect(contrast(edge, pulse.ink)).toBeGreaterThan(1.15);
    expect(contrast(pulse.fg, pulse.inkBtn)).toBeGreaterThanOrEqual(AA);

    expect(contrast(pulse.fg, pulse.inkPop)).toBeGreaterThanOrEqual(AA);
  });

  it("maps the semantic aliases and drops the invented neutrals", () => {
    const colors = tailwindThemeExtend.colors;
    expect(colors.page).toBe(pulse.ink);
    expect(colors["surface-card"]).toBe(pulse.inkRaised);
    expect(colors["surface-tile"]).toBe(pulse.paper04);
    expect(colors["surface-pop"]).toBe(pulse.inkPop);
    expect(colors.primary).toBe(pulse.fg);
    expect(colors.muted).toBe(pulse.paper60);
    expect(colors.quiet).toBe(pulse.paper52);
    expect(colors["on-accent"]).toBe(pulse.onAccent);
    expect(colors.line).toBe(pulse.paper09);
    expect(colors.accent).toBe(pulse.yellow);
    expect(colors["accent-wash"]).toBe(pulse.yellowFaded);
    expect(colors.buzz).not.toHaveProperty("neutralHover");
    expect(colors.buzz).not.toHaveProperty("neutralWash");
  });

  it("ships reduced-motion escapes on every motion utility", () => {
    for (const value of Object.values(MOTION)) {
      expect(value).toContain("motion-reduce:");
    }
  });
});
