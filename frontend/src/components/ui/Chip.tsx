import type { ReactNode } from "react";
import { TEXT, TONE, type Tone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/**
 * Status chip drawn on a photo. Solid ink at 80% so Closed/Full stay readable
 * over any image. `bg-page` is opaque hex, so the `/80` modifier is valid.
 */
export const chipOnMediaClass =
  "border border-line bg-page/80 text-primary backdrop-blur";

/**
 * Status and brand tags. Padding stays tighter than a compact button so a
 * chip reads as a label, not a control. `whitespace-nowrap` is load-bearing:
 * long brand names were wrapping to two lines inside a `rounded-full`.
 *
 * `accent` is the yellow fill (live / waiting). `dot` is the pen's open badge
 * (yellow dot on the faded wash) and only applies when `accent` is off.
 * `onMedia` is the solid chip for labels that sit on photographs.
 */
export function Chip({
  tone = "neutral",
  accent = false,
  dot = false,
  onMedia = false,
  className,
  children,
}: {
  tone?: Tone;
  /** Yellow fill, ink label. For live / brand marks, not body text. */
  accent?: boolean;
  /** 6px dot in the current text color. Pen open-badge. */
  dot?: boolean;
  /** Solid ink chip for labels placed on photos. */
  onMedia?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1",
        TEXT.micro,
        onMedia
          ? chipOnMediaClass
          : accent
            ? "border-transparent bg-accent text-on-accent"
            : TONE[tone],
        className,
      )}
    >
      {dot && !accent ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

/** Sentence-case status pill. Same marks as `Chip`; the name matches the pen. */
export function Badge({
  tone = "warn",
  children,
  className,
}: {
  /** `warn` is the dotted open badge. `success` is done (paper fill). */
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Chip tone={tone} dot={tone === "warn"} className={className}>
      {children}
    </Chip>
  );
}
