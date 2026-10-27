/**
 * Calendar math for the drop editor's date range picker. Local dates only,
 * at midnight. Times live next to the range as plain labels.
 */

export type DateRange = { start: Date | null; end: Date | null };

export type PresetId = "today" | "week" | "two-weeks" | "month" | "custom";

export const PRESETS: readonly { id: PresetId; label: string }[] = [
  { id: "today", label: "Starts today" },
  { id: "week", label: "This week" },
  { id: "two-weeks", label: "Next 2 weeks" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];

const DAY_MS = 86_400_000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function sameDay(a: Date | null, b: Date | null): boolean {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Inclusive day count. Nov 2 → Nov 13 is 12 days. */
export function rangeDays(range: DateRange): number {
  if (!range.start || !range.end) return 0;
  const diff = startOfDay(range.end).getTime() - startOfDay(range.start).getTime();
  return Math.round(diff / DAY_MS) + 1;
}

/**
 * Range for a quick-pick preset, relative to `today`. "Next 2 weeks" is the
 * coming Monday through the Friday after it (Oct 27 → Nov 2–13).
 */
export function presetRange(id: PresetId, today: Date): DateRange | null {
  const t = startOfDay(today);
  switch (id) {
    case "today":
      return { start: t, end: addDays(t, 13) };
    case "week":
      return { start: t, end: addDays(t, 6 - t.getDay()) };
    case "two-weeks": {
      const toMonday = ((8 - t.getDay()) % 7) || 7;
      const monday = addDays(t, toMonday);
      return { start: monday, end: addDays(monday, 11) };
    }
    case "month":
      return { start: t, end: new Date(t.getFullYear(), t.getMonth() + 1, 0) };
    case "custom":
      return null;
  }
}

/** Which preset a range matches, or `custom`. */
export function matchPreset(range: DateRange, today: Date): PresetId {
  for (const { id } of PRESETS) {
    const preset = presetRange(id, today);
    if (preset && sameDay(preset.start, range.start) && sameDay(preset.end, range.end)) {
      return id;
    }
  }
  return "custom";
}

/** Day cells for one month, Sunday first, with leading blanks as `null`. */
export function monthGrid(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= count; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  return cells;
}

/** Second click sets the end; a click before the start restarts the range. */
export function pickDay(range: DateRange, day: Date): DateRange {
  if (!range.start || range.end) return { start: day, end: null };
  if (day.getTime() < range.start.getTime()) return { start: day, end: null };
  return { start: range.start, end: day };
}

const SHORT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

/** "Mon, Nov 2" */
export const formatShort = (date: Date): string => SHORT.format(date);
/** "Nov 2" */
export const formatMonthDay = (date: Date): string => MONTH_DAY.format(date);
/** "October 2026" */
export const formatMonthYear = (date: Date): string => MONTH_YEAR.format(date);
