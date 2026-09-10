/**
 * Shared form control class maps. Pages should use the React primitives in
 * `components/forms/` rather than copying these strings.
 */
import { cx } from "./shells";

export type ControlSize = "default" | "compact";

/**
 * `h-*` is deliberate: control height is a contract, not a side effect of
 * padding. It is what makes a field, a `Select` and a `Button` line up when
 * they sit on the same row — the mismatch the audit found across the admin
 * panel (36px fields beside 32px buttons).
 */
export const CONTROL_HEIGHT = {
  default: "h-12",
  compact: "h-9",
} as const;

const FIELD_BASE =
  "w-full rounded-buzzControl border border-buzz-lineMid text-buzz-ink outline-none transition placeholder:text-buzz-inkFaint focus:border-buzz-coral focus:ring-2 focus:ring-buzz-coral/30 disabled:cursor-not-allowed disabled:bg-buzz-neutralWash disabled:text-buzz-inkMuted disabled:opacity-100";

export const fieldClass: Record<ControlSize, string> = {
  default: cx(FIELD_BASE, CONTROL_HEIGHT.default, "bg-buzz-cream px-3 text-sm"),
  compact: cx(FIELD_BASE, CONTROL_HEIGHT.compact, "bg-buzz-paper px-3 text-sm"),
};

/**
 * Multi-line fields cannot use a fixed height — they grow with `rows`. Same
 * base, same padding rhythm, vertical padding instead of a height lock.
 */
export const textAreaClass: Record<ControlSize, string> = {
  default: cx(FIELD_BASE, "bg-buzz-cream px-3 py-3 text-sm"),
  compact: cx(FIELD_BASE, "bg-buzz-paper px-3 py-2 text-sm"),
};

export const fieldLabelClass = "mb-1 block text-sm font-semibold text-buzz-ink";

/**
 * Dense/admin label. Single grey (`inkMuted`) so it stops competing with the
 * three different label greys the audit found colliding on one admin screen.
 */
export const fieldLabelCompactClass =
  "mb-1 block text-buzzMicro uppercase tracking-wider text-buzz-inkMuted";

/**
 * A native checkbox drawn by the OS could never match a Buzz card: no control
 * over the box, the check, the radius, or the focus ring, and it renders
 * differently per browser. `appearance-none` takes the drawing away from the
 * OS; the tick is a sibling icon revealed with `peer-checked`. Deliberately
 * still a real `<input type="checkbox">`, so `onChange`, form semantics, and
 * every existing test query keep working.
 */
export const checkboxClass =
  "peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-buzzCheck border-2 border-buzz-lineMid bg-buzz-paper outline-none transition checked:border-buzz-coral checked:bg-buzz-coral focus-visible:ring-2 focus-visible:ring-buzz-coral/40 disabled:cursor-not-allowed disabled:opacity-60";

/** Tick mark shown over the box once checked. */
export const checkboxTickClass =
  "pointer-events-none absolute left-0 top-0 h-5 w-5 p-0.5 text-buzz-paper opacity-0 transition-opacity peer-checked:opacity-100";

export const selectWrapClass = "relative";

export const selectChevronClass =
  "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-buzz-inkMuted";
