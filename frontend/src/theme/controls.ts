/**
 * Shared form control class maps. Pages should use the React primitives in
 * `components/forms/` rather than copying these strings.
 */
import { cx } from "./shells";

export type ControlSize = "default" | "compact";

const FIELD_BASE =
  "w-full rounded-buzzControl border border-buzz-lineMid outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral disabled:opacity-60";

export const fieldClass: Record<ControlSize, string> = {
  default: cx(FIELD_BASE, "bg-buzz-cream p-3 text-sm"),
  compact: cx(FIELD_BASE, "bg-buzz-paper p-2 text-sm"),
};

export const fieldLabelClass =
  "mb-1 block text-sm font-semibold text-buzz-ink";

export const fieldLabelCompactClass =
  "mb-1 block text-xs font-bold uppercase tracking-wide text-buzz-inkMuted";

export const checkboxClass =
  "mt-0.5 h-4 w-4 shrink-0 rounded border-buzz-lineMid text-buzz-coral accent-buzz-coral focus:ring-1 focus:ring-buzz-coral disabled:opacity-60";

export const selectWrapClass = "relative";

export const selectChevronClass =
  "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-buzz-inkMuted";
