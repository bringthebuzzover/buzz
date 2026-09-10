import type { InputHTMLAttributes, ReactNode } from "react";
import { checkboxClass } from "../../theme/controls";
import { cx } from "../../theme/shells";

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  const input = (
    <input
      type="checkbox"
      className={cx(checkboxClass, className)}
      {...props}
    />
  );
  if (!label) {
    return input;
  }
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm font-medium text-buzz-ink">
      {input}
      <span>{label}</span>
    </label>
  );
}

export default Checkbox;
