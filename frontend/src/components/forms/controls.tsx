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
  fieldLabelClass,
  fieldLabelCompactClass,
  selectChevronClass,
  selectWrapClass,
  textAreaClass,
  type ControlSize,
} from "../../theme/controls";
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
      <input id={id} className={cn(fieldClass[size], className)} {...props} />
    </div>
  );
}

export function TextArea({
  id,
  label,
  size = "default",
  resizable = false,
  className,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> & {
  label?: ReactNode;
  size?: ControlSize;
  /**
   * Off by default: the OS resize grabber was the last piece of native chrome
   * left on the auth surfaces. Opt in where a user genuinely needs more room.
   */
  resizable?: boolean;
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
        className={cn(
          textAreaClass[size],
          resizable ? "resize-y" : "resize-none",
          className,
        )}
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
          className={cn(
            fieldClass[size],
            "cursor-pointer appearance-none pr-10",
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

/**
 * One button contract for the whole app.
 *
 * `self-center` matters: `AUTH_SHELL.center` is a stretching flex column, so
 * without it a hugging CTA rendered full-bleed with padding sized for a
 * hugging button. `fullWidth` is how a form submit opts back in.
 *
 * Disabled is a designed state, not `opacity` alone — a faded coral fill read
 * as a broken button rather than a gated one.
 */
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 self-center whitespace-nowrap rounded-buzzControl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-buzz-coral/40 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-buzz-coral text-buzz-paper hover:bg-buzz-coralDark disabled:bg-buzz-neutralHover disabled:text-buzz-inkFaint",
        outline:
          "border-2 border-buzz-coral bg-transparent text-buzz-coral hover:bg-buzz-coral hover:text-buzz-paper disabled:border-buzz-neutralHover disabled:bg-transparent disabled:text-buzz-inkFaint",
        ghost:
          "bg-transparent font-medium text-buzz-inkMuted underline-offset-2 hover:text-buzz-coral hover:underline disabled:text-buzz-inkFaint",
        danger:
          "bg-buzz-danger text-buzz-paper hover:opacity-90 disabled:bg-buzz-neutralHover disabled:text-buzz-inkFaint",
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
