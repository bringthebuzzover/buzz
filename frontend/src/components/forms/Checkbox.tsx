import type { InputHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
import { checkboxClass, checkboxTickClass } from "../../theme/controls";
import { cx } from "../../theme/shells";

/**
 * Styled checkbox. Still a native `<input type="checkbox">` (so `onChange`,
 * form submission, and `role`/`aria-*` passthrough are unchanged) but the box
 * is drawn by us, not the OS — see `checkboxClass`.
 *
 * `className` goes to the input, as it always has: `FilterMultiSelect` and the
 * admin config panels rely on that. To move the control itself, use
 * `wrapperClassName` — that is what fixes a checkbox sitting off its own text
 * baseline.
 */
export function Checkbox({
  label,
  className,
  wrapperClassName,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  wrapperClassName?: string;
}) {
  const box = (
    <span className={cx("relative inline-flex shrink-0", wrapperClassName)}>
      <input
        type="checkbox"
        className={cx(checkboxClass, className)}
        {...props}
      />
      <Check className={checkboxTickClass} strokeWidth={3} aria-hidden />
    </span>
  );
  if (!label) {
    return box;
  }
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-buzz-ink">
      {box}
      <span>{label}</span>
    </label>
  );
}

export default Checkbox;
