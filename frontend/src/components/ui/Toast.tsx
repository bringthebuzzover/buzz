import type { ReactNode } from "react";
import { X } from "lucide-react";
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
          className={cn(
            "-m-1 inline-flex shrink-0 rounded-full p-1 text-current opacity-70 transition hover:opacity-100",
            focusRingClass,
          )}
          aria-label="Dismiss"
        >
          <X size={16} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
