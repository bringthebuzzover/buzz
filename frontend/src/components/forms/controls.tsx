import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Link, type LinkProps } from "react-router-dom";
import {
  fieldClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
  fieldLabelCompactClass,
  focusRingClass,
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

function joinDescribedBy(
  ...parts: Array<string | undefined>
): string | undefined {
  const value = parts
    .flatMap((part) => (part ? part.split(/\s+/) : []))
    .filter(Boolean);
  return value.length ? value.join(" ") : undefined;
}

/**
 * Stable id for the control, plus hint/error ids. A caller `aria-describedby`
 * is merged in so an external error (org apply) does not drop the hint.
 */
function useDescribedField(
  id: string | undefined,
  hint: ReactNode | undefined,
  error: string | undefined,
  ariaDescribedBy: string | undefined,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = joinDescribedBy(
    error ? errorId : hintId,
    ariaDescribedBy,
  );
  return { fieldId, hintId, errorId, describedBy };
}

export function TextField({
  id,
  label,
  hint,
  error,
  size = "default",
  className,
  "aria-describedby": ariaDescribedBy,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: ReactNode;
  /** Quiet helper under the field. Hidden while `error` is set. */
  hint?: ReactNode;
  error?: string;
  size?: ControlSize;
}) {
  const { fieldId, hintId, errorId, describedBy } = useDescribedField(
    id,
    hint,
    error,
    ariaDescribedBy,
  );
  return (
    <div>
      {label && (
        <FieldLabel htmlFor={fieldId} size={size}>
          {label}
        </FieldLabel>
      )}
      <input
        className={cn(fieldClass[size], error && fieldErrorClass, className)}
        {...props}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? <FieldError id={errorId ?? `${fieldId}-error`} message={error} /> : null}
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
  "aria-describedby": ariaDescribedBy,
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
  const { fieldId, hintId, errorId, describedBy } = useDescribedField(
    id,
    hint,
    error,
    ariaDescribedBy,
  );
  return (
    <div className={wrapperClassName}>
      {label && (
        <FieldLabel htmlFor={fieldId} size={size}>
          {label}
        </FieldLabel>
      )}
      <textarea
        className={cn(
          textAreaClass[size],
          resizable ? "resize-y" : "resize-none",
          error && fieldErrorClass,
          className,
        )}
        {...props}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? <FieldError id={errorId ?? `${fieldId}-error`} message={error} /> : null}
      {hint && !error ? (
        <p id={hintId} className={fieldHintClass}>
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
  "aria-describedby": ariaDescribedBy,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  size?: ControlSize;
}) {
  const { fieldId, hintId, errorId, describedBy } = useDescribedField(
    id,
    hint,
    error,
    ariaDescribedBy,
  );
  return (
    <div>
      {label && (
        <FieldLabel htmlFor={fieldId} size={size}>
          {label}
        </FieldLabel>
      )}
      <div className={selectWrapClass}>
        <select
          className={cn(
            fieldClass[size],
            "cursor-pointer appearance-none pr-10",
            error && fieldErrorClass,
            className,
          )}
          {...props}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
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
      {error ? <FieldError id={errorId ?? `${fieldId}-error`} message={error} /> : null}
      {hint && !error ? (
        <p id={hintId} className={fieldHintClass}>
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
 * Pen pills: primary is yellow with ink type (40px), secondary is the dark pill
 * (36px, paper-09 line), ghost and outline are the stroked 44px pill, danger
 * is the solid red pill. Labels on yellow are `on-accent` (#0b0b0b, 13.4:1).
 * Light paper type on yellow is 1.29:1 and is not used.
 *
 * Disabled is a designed state, not `opacity` alone.
 */
const GHOST_PILL =
  "h-11 border border-primary bg-transparent px-6 text-sm text-primary hover:border-accent hover:bg-accent hover:text-on-accent disabled:border-transparent disabled:bg-transparent disabled:text-quiet";

export const buttonVariants = cva(
  `inline-flex select-none items-center justify-center gap-2 self-center whitespace-nowrap rounded-full font-normal transition disabled:cursor-not-allowed ${focusRingClass}`,
  {
    variants: {
      variant: {
        // Pen Pill / Yellow: 40px, 14px, weight 400.
        primary:
          "h-10 bg-accent px-4 text-sm text-on-accent hover:bg-buzz-yellowHover disabled:bg-buzz-neutral disabled:text-quiet",
        // Pen Pill / Dark: 36px, paper-09 line so the fill reads on the page.
        secondary:
          "h-9 border border-line bg-buzz-inkBtn px-3.5 text-xs text-primary hover:bg-surface-pop disabled:border-transparent disabled:bg-buzz-neutral disabled:text-quiet",
        // Pen Pill / Ghost: 44px, paper stroke, padding 24. `outline` keeps the old name.
        outline: GHOST_PILL,
        ghost: GHOST_PILL,
        // Pen Pill / Danger: 40px, solid red, paper label, weight 400.
        danger:
          "h-10 bg-buzz-dangerFill px-4 text-sm text-primary hover:bg-buzz-dangerInk hover:text-on-accent disabled:bg-buzz-neutral disabled:text-quiet",
      },
      size: {
        default: "",
        compact: "h-9 px-3 text-xs",
        /** 48px. Only for a button sitting on the same row as a field. */
        field: "h-12 px-4 text-sm",
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
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariants & {
    /** Disables the control and shows `loadingLabel` while a submit is in flight. */
    loading?: boolean;
    loadingLabel?: ReactNode;
  }) {
  const busy = Boolean(loading);
  return (
    <button
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && loadingLabel != null ? loadingLabel : children}
    </button>
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

/** Pen Notice: yellow-faded fill, yellow line, paper text. Not the paper success chip. */
export function SuccessBanner({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-buzzField border border-buzz-yellowLine bg-accent-wash px-4 py-4 text-sm text-primary"
      role="status"
    >
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function WarningBanner({ children }: { children: ReactNode }) {
  return <Banner tone="warn">{children}</Banner>;
}
