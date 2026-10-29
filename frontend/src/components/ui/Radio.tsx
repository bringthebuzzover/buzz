import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../theme/cn";

/**
 * Radio option. Same idea as `Checkbox`: a real input, our own circle.
 * The dot is ink on yellow when checked.
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
          "peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-full border border-buzz-inkMuted bg-buzz-paper outline-none transition checked:border-buzz-yellow checked:bg-buzz-yellow focus-visible:ring-2 focus-visible:ring-buzz-yellow/40 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-buzz-onAccent opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
  if (!label) return box;
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-buzzField border border-buzz-line bg-buzz-paper04 px-4 py-3 text-sm text-buzz-fg">
      {box}
      <span>{label}</span>
    </label>
  );
}
