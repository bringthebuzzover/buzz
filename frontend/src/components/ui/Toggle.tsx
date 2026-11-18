import type { ButtonHTMLAttributes, ReactNode } from "react";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

/**
 * Pen toggle. 36×22. On is a yellow track with an ink knob; off is a paper-09
 * track with a paper knob.
 */
export function Toggle({
  checked,
  onChange,
  label,
  className,
  disabled,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[22px] w-9 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-accent" : "bg-buzz-paper09",
        focusRingClass,
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-[3px] h-4 w-4 rounded-full transition-[left]",
          checked ? "left-[17px] bg-on-accent" : "left-[3px] bg-primary",
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}
