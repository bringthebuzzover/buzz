/**
 * Shared form control class maps. Pages should use the React primitives in
 * `components/forms/` rather than copying these strings.
 */
import { cx } from "./shells";

export type ControlSize = "default" | "compact";

/**
 * Field height. Default fields are the pen's 48px box; compact fields are 36px.
 * Yellow pills are 40px and do not use this scale. `Button size="field"` is the
 * 48px size for a button on the same row as a default field. Compact fields
 * still line up with `Button size="compact"`.
 */
export const CONTROL_HEIGHT = {
  default: "h-12",
  compact: "h-9",
} as const;

/** Solid yellow ring with a page-colored offset. Yellow at 40% is under 3:1 on ink. */
export const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-buzz-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-page";

const FIELD_FOCUS =
  "focus:border-buzz-yellow focus:ring-2 focus:ring-buzz-yellow focus:ring-offset-2 focus:ring-offset-page";

const FIELD_BASE =
  `w-full rounded-buzzField border border-line text-primary outline-none transition placeholder:text-quiet disabled:cursor-not-allowed disabled:bg-buzz-neutral disabled:text-muted disabled:opacity-100 ${FIELD_FOCUS}`;

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

export const fieldLabelClass = "mb-2 block text-sm font-medium text-primary";

/**
 * Dense/admin label. Same ink, one step down. Not uppercase — the pen's
 * field labels are sentence case.
 */
export const fieldLabelCompactClass = "mb-2 block text-xs font-medium text-muted";

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
  `peer h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-buzzCheck border border-quiet bg-transparent outline-none transition checked:border-buzz-yellow checked:bg-buzz-yellow disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`;

/** Tick mark shown over the box once checked. 12px ink check on yellow. */
export const checkboxTickClass =
  "pointer-events-none absolute left-0 top-0 h-[18px] w-[18px] p-[3px] text-on-accent opacity-0 transition-opacity peer-checked:opacity-100";

export const selectWrapClass = "relative";

export const selectChevronClass =
  "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-buzz-inkMuted";
