/**
 * Shared form control class maps. Pages should use the React primitives in
 * `components/forms/` rather than copying these strings.
 */
import { cx } from "./shells";

export type ControlSize = "default" | "compact";

/**
 * `h-*` is deliberate: control height is a contract, not a side effect of
 * padding. It is what makes a field, a `Select` and a `Button` line up when
 * they sit on the same row. The pen's yellow pill is 40px and the field is
 * 48px; we keep one height per size so that row contract holds (default 48,
 * compact 36).
 */
export const CONTROL_HEIGHT = {
  default: "h-12",
  compact: "h-9",
} as const;

const FIELD_BASE =
  "w-full rounded-buzzField border border-buzz-line text-buzz-fg outline-none transition placeholder:text-buzz-inkFaint focus:border-buzz-yellow focus:ring-2 focus:ring-buzz-yellow/40 disabled:cursor-not-allowed disabled:bg-buzz-neutral disabled:text-buzz-inkMuted disabled:opacity-100";

export const fieldClass: Record<ControlSize, string> = {
  default: cx(FIELD_BASE, CONTROL_HEIGHT.default, "bg-buzz-paper04 px-4 text-sm"),
  compact: cx(FIELD_BASE, CONTROL_HEIGHT.compact, "bg-buzz-paper04 px-3 text-sm"),
};

/**
 * Multi-line fields cannot use a fixed height — they grow with `rows`. Same
 * base, same padding rhythm, vertical padding instead of a height lock.
 */
export const textAreaClass: Record<ControlSize, string> = {
  default: cx(FIELD_BASE, "bg-buzz-paper04 px-4 py-3 text-sm"),
  compact: cx(FIELD_BASE, "bg-buzz-paper04 px-3 py-2 text-sm"),
};

export const fieldLabelClass = "mb-1 block text-sm font-medium text-buzz-fg";

/**
 * Dense/admin label. Same ink, one step down. Not uppercase — the pen's
 * field labels are sentence case.
 */
export const fieldLabelCompactClass = "mb-1 block text-xs font-medium text-buzz-inkMuted";

/** Hint under a field. paper-52 clears AA on ink and on ink-raised. */
export const fieldHintClass = "mt-1 text-xs text-buzz-inkFaint";

/** Error border swapped onto the field when `error` is set. */
export const fieldErrorClass =
  "border-buzz-danger focus:border-buzz-danger focus:ring-buzz-danger/30";

/**
 * A native checkbox drawn by the OS could never match a Buzz card: no control
 * over the box, the check, the radius, or the focus ring, and it renders
 * differently per browser. `appearance-none` takes the drawing away from the
 * OS; the tick is a sibling icon revealed with `peer-checked`.
 */
export const checkboxClass =
  "peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-buzzCheck border border-buzz-inkMuted bg-buzz-paper outline-none transition checked:border-buzz-yellow checked:bg-buzz-yellow focus-visible:ring-2 focus-visible:ring-buzz-yellow/40 disabled:cursor-not-allowed disabled:opacity-60";

/** Tick mark shown over the box once checked. Ink on yellow. */
export const checkboxTickClass =
  "pointer-events-none absolute left-0 top-0 h-5 w-5 p-0.5 text-buzz-onAccent opacity-0 transition-opacity peer-checked:opacity-100";

export const selectWrapClass = "relative";

export const selectChevronClass =
  "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-buzz-inkMuted";
