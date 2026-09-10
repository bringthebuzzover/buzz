import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import {
  fieldClass,
  fieldLabelClass,
  fieldLabelCompactClass,
  selectChevronClass,
  selectWrapClass,
  type ControlSize,
} from "../../theme/controls";
import { cx } from "../../theme/shells";

export { fieldClass, fieldLabelClass, fieldLabelCompactClass };

function FieldLabel({
  htmlFor,
  size,
  children,
}: {
  htmlFor?: string;
  size: ControlSize;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={size === "compact" ? fieldLabelCompactClass : fieldLabelClass}
    >
      {children}
    </label>
  );
}

export function TextField({
  id,
  label,
  size = "default",
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: ReactNode;
  size?: ControlSize;
}) {
  return (
    <div>
      {label && (
        <FieldLabel htmlFor={id} size={size}>
          {label}
        </FieldLabel>
      )}
      <input id={id} className={cx(fieldClass[size], className)} {...props} />
    </div>
  );
}

export function TextArea({
  id,
  label,
  size = "default",
  className,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> & {
  label?: ReactNode;
  size?: ControlSize;
}) {
  return (
    <div>
      {label && (
        <FieldLabel htmlFor={id} size={size}>
          {label}
        </FieldLabel>
      )}
      <textarea
        id={id}
        className={cx(fieldClass[size], "resize-y", className)}
        {...props}
      />
    </div>
  );
}

export function DateTimeField({
  id,
  label,
  size = "compact",
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: ReactNode;
  size?: ControlSize;
}) {
  return (
    <TextField
      id={id}
      label={label}
      size={size}
      className={className}
      {...props}
      type="datetime-local"
    />
  );
}

export function Select({
  id,
  label,
  size = "default",
  className,
  children,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  label?: ReactNode;
  size?: ControlSize;
}) {
  return (
    <div>
      {label && (
        <FieldLabel htmlFor={id} size={size}>
          {label}
        </FieldLabel>
      )}
      <div className={selectWrapClass}>
        <select
          id={id}
          className={cx(
            fieldClass[size],
            "appearance-none bg-buzz-cream pr-10",
            size === "compact" && "bg-buzz-paper",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          className={selectChevronClass}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
}

export { Checkbox } from "./Checkbox";

export function Button({
  variant = "primary",
  size = "default",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  size?: ControlSize | "hero";
}) {
  const sizes = {
    default: "px-4 py-3 text-sm font-bold",
    compact: "px-3 py-1.5 text-xs font-bold",
    hero: "w-full py-4 text-lg font-bold",
  };
  const variants = {
    primary:
      "rounded-buzzControl bg-buzz-coral text-buzz-paper shadow-md transition hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60",
    outline:
      "rounded-buzzControl border-2 border-buzz-coral bg-transparent text-buzz-coral transition hover:bg-buzz-coral hover:text-buzz-paper disabled:opacity-60",
    ghost:
      "rounded-buzzControl bg-transparent font-medium text-buzz-inkMuted underline-offset-2 hover:underline disabled:opacity-60",
  };
  return (
    <button
      className={cx(variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      className="rounded-buzzControl bg-buzz-dangerWash p-3 text-center text-sm font-medium text-buzz-danger"
      role="alert"
    >
      {children}
    </div>
  );
}
