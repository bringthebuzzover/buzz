import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Link, type LinkProps } from "react-router-dom";
import {
  CONTROL_HEIGHT,
  fieldClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
  fieldLabelCompactClass,
  selectChevronClass,
  selectWrapClass,
  textAreaClass,
  type ControlSize,
} from "../../theme/controls";
import FieldError from "./FieldError";
import { TONE, type Tone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

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
  hint,
  error,
  size = "default",
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: ReactNode;
  /** Quiet helper under the field. Hidden while `error` is set. */
  hint?: ReactNode;
  error?: string;
  size?: ControlSize;
}) {
  const hintId = hint && id ? `${id}-hint` : undefined;
  const errorId = error && id ? `${id}-error` : undefined;
  const describedBy = [errorId, hint && !error ? hintId : undefined]
    .filter(Boolean)
    .join(" ") || undefined;
  return (
    <div>
      {label && (
        <FieldLabel htmlFor={id} size={size}>
          {label}
        </FieldLabel>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(fieldClass[size], error && fieldErrorClass, className)}
        {...props}
      />
      {error ? <FieldError id={errorId ?? `${id ?? "field"}-error`} message={error} /> : null}
      {hint && !error ? (
        <p id={hintId} className={fieldHintClass}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextArea({
  id,
  label,
  hint,
  error,
  size = "default",
  resizable = false,
  className,
  wrapperClassName,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  size?: ControlSize;
  wrapperClassName?: string;
  /**
   * Off by default: the OS resize grabber was the last piece of native chrome
   * left on the auth surfaces. Opt in where a user genuinely needs more room.
   */
  resizable?: boolean;
}) {
  return (
    <div className={wrapperClassName}>
      {label && (
        <FieldLabel htmlFor={id} size={size}>
          {label}
        </FieldLabel>
      )}
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error && id ? `${id}-error` : undefined, hint && !error && id ? `${id}-hint` : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn(
          textAreaClass[size],
          resizable ? "resize-y" : "resize-none",
          error && fieldErrorClass,
          className,
        )}
        {...props}
      />
      {error ? <FieldError id={id ? `${id}-error` : "textarea-error"} message={error} /> : null}
      {hint && !error ? (
        <p id={id ? `${id}-hint` : undefined} className={fieldHintClass}>
          {hint}
        </p>
      ) : null}
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
      // `buzz-datetime` restyles the browser's calendar glyph to match the
      // Select chevron (see index.css). Keeping `type="datetime-local"` is a
      // hard requirement — E2E fills these fields.
      className={cn("buzz-datetime", className)}
      {...props}
      type="datetime-local"
    />
  );
}

/**
 * Native `<select>` on purpose: it keeps the OS picker on mobile (better than
 * any custom listbox on a phone), stays accessible for free, and keeps
 * `selectOption` working in E2E. Only the chrome is ours — `appearance-none`
 * plus our own chevron.
 */
export function Select({
  id,
  label,
  hint,
  error,
  size = "default",
  className,
  children,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
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
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [error && id ? `${id}-error` : undefined, hint && !error && id ? `${id}-hint` : undefined]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={cn(
            fieldClass[size],
            "cursor-pointer appearance-none pr-10",
            error && fieldErrorClass,
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
      {error ? <FieldError id={id ? `${id}-error` : "select-error"} message={error} /> : null}
      {hint && !error ? (
        <p id={id ? `${id}-hint` : undefined} className={fieldHintClass}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { Checkbox } from "./Checkbox";
export { Radio } from "../ui/Radio";

/**
 * One button contract for the whole app.
 *
 * `self-center` matters: `AUTH_SHELL.center` is a stretching flex column, so
 * without it a hugging CTA rendered full-bleed with padding sized for a
 * hugging button. `fullWidth` is how a form submit opts back in.
 *
 * Pen pills: primary is yellow with ink type, secondary is the dark pill,
 * outline is the stroked ghost pill, ghost is text only, danger is the solid
 * red pill. Labels on yellow are `onAccent` (#0b0b0b, 13.4:1). Light paper
 * type on yellow is 1.29:1 and is not used.
 *
 * Disabled is a designed state, not `opacity` alone.
 */
export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 self-center whitespace-nowrap rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-buzz-yellow/40 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-buzz-yellow text-buzz-onAccent hover:bg-buzz-yellowHover disabled:bg-buzz-neutral disabled:text-buzz-inkFaint",
        secondary:
          "bg-buzz-inkBtn text-buzz-fg hover:bg-buzz-inkPop disabled:bg-buzz-neutral disabled:text-buzz-inkFaint",
        outline:
          "border border-buzz-fg bg-transparent text-buzz-fg hover:border-buzz-yellow hover:bg-buzz-yellow hover:text-buzz-onAccent disabled:border-buzz-neutral disabled:bg-transparent disabled:text-buzz-inkFaint",
        ghost:
          "bg-transparent text-buzz-inkMuted hover:text-buzz-yellow disabled:text-buzz-inkFaint",
        danger:
          "bg-buzz-dangerFill text-buzz-fg hover:bg-buzz-dangerInk hover:text-buzz-onAccent disabled:bg-buzz-neutral disabled:text-buzz-inkFaint",
      },
      size: {
        default: `${CONTROL_HEIGHT.default} px-5 text-sm`,
        compact: `${CONTROL_HEIGHT.compact} px-3 text-xs`,
        hero: "h-14 px-8 text-base",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "default", fullWidth: false },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

export function Button({
  variant,
  size,
  fullWidth,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonVariants) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}

/**
 * Router link that looks exactly like a `Button`. Marketing CTAs and success
 * screens used to hand-roll coral fills with their own padding and radius;
 * this keeps them navigable (real `href`, middle-clickable) and on-system.
 */
export function LinkButton({
  variant,
  size,
  fullWidth,
  className,
  ...props
}: LinkProps & ButtonVariants) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}

/** Same, for external/`mailto:` destinations. */
export function AnchorButton({
  variant,
  size,
  fullWidth,
  className,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & ButtonVariants) {
  return (
    <a
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      {children}
    </a>
  );
}

/**
 * Status banner. `ErrorBanner` kept its name and role (`alert`) because it is
 * used in ~20 places; success and warning now share its box instead of each
 * page inventing a green or amber wash from the stock palette.
 */
export function Banner({
  tone,
  className,
  children,
}: {
  tone: Tone;
  className?: string;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <div
      className={cn(
        "rounded-buzzControl border px-3 py-2 text-sm font-medium",
        TONE[tone],
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <Banner tone="danger" className="text-center">
      {children}
    </Banner>
  );
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return <Banner tone="success">{children}</Banner>;
}

export function WarningBanner({ children }: { children: ReactNode }) {
  return <Banner tone="warn">{children}</Banner>;
}
