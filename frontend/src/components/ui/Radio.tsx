import type { InputHTMLAttributes, ReactNode } from "react";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

/**
 * Radio option. Same idea as `Checkbox`: a real input, our own circle.
 * Pen: 18px circle, paper-52 ring; checked is yellow with an 8px ink dot.
 *
 * With a `label` it is the pen "Radio option" row: paper-04 tile, paper-09
 * line, and the yellow-faded wash with the yellow line once checked.
 */
export function Radio({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  const box = (
    <span className="relative inline-flex shrink-0">
      <input
        type="radio"
        className={cn(
          "peer h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-full border border-quiet bg-transparent outline-none transition checked:border-accent checked:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
          focusRingClass,
          className,
        )}
        {...props}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-on-accent opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
  if (!label) return box;
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-buzzField border border-line bg-surface-tile px-4 py-3 text-sm text-primary transition hover:border-quiet has-[:checked]:border-buzz-yellowLine has-[:checked]:bg-accent-wash">
      {box}
      <span>{label}</span>
    </label>
  );
}
