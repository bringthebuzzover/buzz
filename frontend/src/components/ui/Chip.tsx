import type { ReactNode } from "react";
import { TEXT, TONE, type Tone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/**
 * The micro pill used for statuses, brand labels, and counts.
 *
 * The class string this replaces —
 * `rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider` —
 * was copy-pasted across five components with three different tone maps, so
 * chips drifted apart between the org feed, the campaign list, and the brand
 * dashboard.
 *
 * `whitespace-nowrap` is load-bearing: long brand names were wrapping to two
 * lines inside a `rounded-full`, producing lopsided lozenges on mobile.
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
        "inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1",
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
