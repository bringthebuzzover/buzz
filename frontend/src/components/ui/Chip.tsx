import type { ReactNode } from "react";
import { TEXT, TONE, type Tone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/**
 * Status and brand tags. Padding stays tighter than a compact button so a
 * chip reads as a label, not a control. `whitespace-nowrap` is load-bearing:
 * long brand names were wrapping to two lines inside a `rounded-full`,
 * producing lopsided lozenges on mobile.
 */
export function Chip({
  tone = "neutral",
  accent = false,
  className,
  children,
}: {
  tone?: Tone;
  /** Coral fill for brand/identity labels rather than status. */
  accent?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5",
        TEXT.micro,
        accent
          ? "border-buzz-coral bg-buzz-coral text-buzz-paper"
          : TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
