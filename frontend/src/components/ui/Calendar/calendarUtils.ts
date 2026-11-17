/**
 * Core date, time, and calendar math utilities.
 *
 * Implements wall-clock parsing and generation to eliminate timezone boundary
 * shifting (e.g. UTC ISO string shifting to previous evening in US timezones).
 */

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_SHORT_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export function padZero(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export interface ParsedDate {
  year: number;
  month: number; // 0-11
  day: number; // 1-31
}

export interface ParsedDateTime extends ParsedDate {
  hours: number; // 0-23
  minutes: number; // 0-59
}

export interface CalendarDay {
  year: number;
  month: number; // 0-11
  day: number;
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  isoString: string; // YYYY-MM-DD
}

/**
 * Parse an ISO date (YYYY-MM-DD) or datetime string into wall-clock parts.
 */
export function parseISODate(str?: string | null): ParsedDate | null {
  if (!str) return null;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

/**
 * Parse an ISO datetime (YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm) into wall-clock parts.
 */
export function parseISODateTime(str?: string | null): ParsedDateTime | null {
  if (!str) return null;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s+)(\d{2}):(\d{2})/);
  if (!match) {
    const dateOnly = parseISODate(str);
    if (!dateOnly) return null;
    return { ...dateOnly, hours: 12, minutes: 0 };
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
    return null;
  }
  return { year, month, day, hours, minutes };
}

/**
 * Format wall-clock date parts as YYYY-MM-DD.
 */
export function formatISODate(year: number, month: number, day: number): string {
  return `${year}-${padZero(month + 1)}-${padZero(day)}`;
}

/**
 * Format wall-clock datetime parts as YYYY-MM-DDTHH:mm.
 */
export function formatISODateTime(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
): string {
  return `${formatISODate(year, month, day)}T${padZero(hours)}:${padZero(minutes)}`;
}

/**
 * Today's local date components.
 */
export function getTodayParts(): ParsedDateTime {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
    hours: now.getHours(),
    minutes: now.getMinutes(),
  };
}

/**
 * Add or subtract whole days from an ISO date without passing through UTC,
 * which would shift the day across timezone boundaries.
 */
export function addDaysISO(iso: string, days: number): string {
  const parts = parseISODate(iso);
  if (!parts) return iso;
  const next = new Date(parts.year, parts.month, parts.day + days);
  return formatISODate(next.getFullYear(), next.getMonth(), next.getDate());
}

/**
 * Compare two ISO dates lexicographically. Returns <0, 0 or >0. Safe because
 * `YYYY-MM-DD` sorts identically as text and as time.
 */
export function compareISO(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Inclusive day count between two ISO dates. `Nov 19 → Nov 30` is 12 days.
 */
export function countDaysInclusive(startIso: string, endIso: string): number {
  const a = parseISODate(startIso);
  const b = parseISODate(endIso);
  if (!a || !b) return 0;
  const aMs = Date.UTC(a.year, a.month, a.day);
  const bMs = Date.UTC(b.year, b.month, b.day);
  return Math.round((bMs - aMs) / 86_400_000) + 1;
}

/**
 * Number of days in a given year and month (0-11).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Day of week of the 1st of the month (0 = Sunday).
 */
export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Generate 35 or 42 grid cells for calendar month rendering.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  selectedIso?: string | null,
  minIso?: string | null,
  maxIso?: string | null,
): CalendarDay[] {
  const today = getTodayParts();
  const todayIso = formatISODate(today.year, today.month, today.day);

  const daysInCurrent = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  // Previous month padding
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrev = getDaysInMonth(prevYear, prevMonth);

  const cells: CalendarDay[] = [];

  // Trailing days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    const isoString = formatISODate(prevYear, prevMonth, day);
    const isDisabled =
      (Boolean(minIso) && isoString < minIso!) ||
      (Boolean(maxIso) && isoString > maxIso!);
    cells.push({
      year: prevYear,
      month: prevMonth,
      day,
      date: new Date(prevYear, prevMonth, day),
      isCurrentMonth: false,
      isToday: isoString === todayIso,
      isSelected: isoString === selectedIso,
      isDisabled,
      isoString,
    });
  }

  // Days of current month
  for (let day = 1; day <= daysInCurrent; day++) {
    const isoString = formatISODate(year, month, day);
    const isDisabled =
      (Boolean(minIso) && isoString < minIso!) ||
      (Boolean(maxIso) && isoString > maxIso!);
    cells.push({
      year,
      month,
      day,
      date: new Date(year, month, day),
      isCurrentMonth: true,
      isToday: isoString === todayIso,
      isSelected: isoString === selectedIso,
      isDisabled,
      isoString,
    });
  }

  // Leading days of next month (fill up to full 35 or 42 grid rows)
  const remaining = (7 - (cells.length % 7)) % 7;
  const totalNeeded = cells.length + remaining < 35 ? 35 - cells.length : remaining;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  for (let day = 1; day <= totalNeeded; day++) {
    const isoString = formatISODate(nextYear, nextMonth, day);
    const isDisabled =
      (Boolean(minIso) && isoString < minIso!) ||
      (Boolean(maxIso) && isoString > maxIso!);
    cells.push({
      year: nextYear,
      month: nextMonth,
      day,
      date: new Date(nextYear, nextMonth, day),
      isCurrentMonth: false,
      isToday: isoString === todayIso,
      isSelected: isoString === selectedIso,
      isDisabled,
      isoString,
    });
  }

  return cells;
}

/**
 * Format display text for a date: e.g. "Nov 24, 2026"
 */
export function formatDisplayDate(date?: ParsedDate | null): string {
  if (!date) return "";
  return `${MONTH_SHORT_NAMES[date.month]} ${date.day}, ${date.year}`;
}

/**
 * Format display text for time (12h format): e.g. "8:52 AM"
 */
export function formatDisplayTime(hours: number, minutes: number): string {
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${padZero(minutes)} ${ampm}`;
}

/**
 * Format display text for datetime: e.g. "Nov 24, 2026, 8:52 AM"
 */
export function formatDisplayDateTime(dt?: ParsedDateTime | null): string {
  if (!dt) return "";
  return `${formatDisplayDate(dt)}, ${formatDisplayTime(dt.hours, dt.minutes)}`;
}

/**
 * Convert 12h representation to 24h hours.
 */
export function to24Hour(hour12: number, ampm: "AM" | "PM"): number {
  if (ampm === "AM") {
    return hour12 === 12 ? 0 : hour12;
  } else {
    return hour12 === 12 ? 12 : hour12 + 12;
  }
}

/**
 * Convert 24h hours to 12h representation.
 */
export function from24Hour(hours: number): { hour12: number; ampm: "AM" | "PM" } {
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return { hour12, ampm };
}
