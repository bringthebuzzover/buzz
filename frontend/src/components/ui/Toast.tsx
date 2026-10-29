import type { ReactNode } from "react";
import { focusRingClass } from "../../theme/controls";
import { TONE, type Tone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/**
 * Toast. The page owns the list — there is no app-wide provider in this
 * foundation, so mounting one doesn't change existing flows.
 */
export function Toast({
  tone = "neutral",
  children,
  onDismiss,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-buzzField border px-4 py-3 text-sm shadow-buzzLg",
        TONE[tone],
        className,
      )}
    >
      <p className="min-w-0 flex-1">{children}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className={cn("rounded-full px-1 text-current", focusRingClass)}
          aria-label="Dismiss"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
