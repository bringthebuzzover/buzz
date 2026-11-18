/**
 * The one month grid every picker builds on.
 *
 * `CalendarGrid` owns month navigation, the weekday row and the day cells —
 * including the range capsule, the today ring and its `TODAY` marker. It knows
 * nothing about hours, footers or popovers: `Calendar`, `DateTimePicker` and
 * `DateRangePicker` each wrap it and add their own footer.
 */
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../../theme/cn";
import { MOTION } from "../../../theme/motion";
import { focusRingClass } from "../../../theme/controls";
import {
  MONTH_NAMES,
  MONTH_SHORT_NAMES,
  WEEKDAY_LABELS,
  addDaysISO,
  buildMonthGrid,
  compareISO,
  formatISODate,
  getTodayParts,
  parseISODate,
  type CalendarDay,
} from "./calendarUtils";

export type CalendarMode = "single" | "range";

export interface CalendarGridProps {
  mode?: CalendarMode;
  /** Single-date selection (YYYY-MM-DD). */
  value?: string | null;
  /** Range start (YYYY-MM-DD). */
  rangeStart?: string | null;
  /** Range end (YYYY-MM-DD). */
  rangeEnd?: string | null;
  /** Date under the pointer while choosing the second range endpoint. */
  hoverDate?: string | null;
  onSelect: (iso: string) => void;
  onHoverDate?: (iso: string | null) => void;
  minDate?: string | null;
  maxDate?: string | null;
  /** Month the grid opens on (YYYY-MM-DD). Falls back to the selection, then today. */
  initialMonth?: string | null;
  className?: string;
}

const dateOnly = (iso?: string | null): string | null => {
  const parts = parseISODate(iso);
  return parts ? formatISODate(parts.year, parts.month, parts.day) : null;
};

export function CalendarGrid({
  mode = "single",
  value,
  rangeStart,
  rangeEnd,
  hoverDate,
  onSelect,
  onHoverDate,
  minDate,
  maxDate,
  initialMonth,
  className,
}: CalendarGridProps) {
  const today = useMemo(() => getTodayParts(), []);
  const todayIso = formatISODate(today.year, today.month, today.day);

  const anchor =
    dateOnly(value) ?? dateOnly(rangeStart) ?? dateOnly(initialMonth);
  const anchorParts = parseISODate(anchor);

  const [viewYear, setViewYear] = useState(anchorParts?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState(anchorParts?.month ?? today.month);
  const gridRef = useRef<HTMLDivElement>(null);

  // Follow the selection when it is set from outside the grid.
  useEffect(() => {
    const next = parseISODate(dateOnly(value) ?? dateOnly(rangeStart));
    if (!next) return;
    setViewYear(next.year);
    setViewMonth(next.month);
  }, [value, rangeStart]);

  const shiftMonth = (by: number) => {
    const next = new Date(viewYear, viewMonth + by, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const minIso = dateOnly(minDate);
  const maxIso = dateOnly(maxDate);
  const selectedIso = dateOnly(value);
  const startIso = dateOnly(rangeStart);
  const endIso = dateOnly(rangeEnd);

  // While only the start is picked, the hover previews the closing capsule.
  const previewEnd = endIso ?? dateOnly(hoverDate);
  const bounds = useMemo(() => {
    if (mode !== "range" || !startIso) return null;
    if (!previewEnd) return { lo: startIso, hi: startIso };
    return compareISO(startIso, previewEnd) <= 0
      ? { lo: startIso, hi: previewEnd }
      : { lo: previewEnd, hi: startIso };
  }, [mode, startIso, previewEnd]);

  const days = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, selectedIso, minIso, maxIso),
    [viewYear, viewMonth, selectedIso, minIso, maxIso],
  );

  const inSpan = (cell: CalendarDay) =>
    !!bounds &&
    compareISO(cell.isoString, bounds.lo) >= 0 &&
    compareISO(cell.isoString, bounds.hi) <= 0;

  const isEndpoint = (cell: CalendarDay) =>
    mode === "range"
      ? cell.isoString === startIso || cell.isoString === endIso
      : cell.isoString === selectedIso;

  const focusDay = (iso: string) => {
    window.requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)
        ?.focus();
    });
  };

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    cell: CalendarDay,
  ) => {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (step[event.key] === undefined) return;
    event.preventDefault();
    const target = addDaysISO(cell.isoString, step[event.key]);
    const targetParts = parseISODate(target)!;
    if (targetParts.month !== viewMonth) {
      setViewYear(targetParts.year);
      setViewMonth(targetParts.month);
    }
    focusDay(target);
  };

  const jumpToToday = () => {
    setViewYear(today.year);
    setViewMonth(today.month);
  };

  return (
    <div className={cn("select-none", className)}>
      {/* Chevrons at the edges, today pill centered — the reference header. */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className={cn(
            "grid size-8 place-items-center rounded-full border border-line text-muted hover:border-buzz-yellowLine hover:text-buzz-yellow",
            MOTION.press,
            focusRingClass,
          )}
        >
          <ChevronLeft className="size-4" />
        </button>

        <button
          type="button"
          onClick={jumpToToday}
          title="Show the current month"
          className={cn(
            "inline-flex items-center rounded-full border border-buzz-yellowLine bg-accent-wash px-3 py-1 text-buzzLabel text-buzz-yellow hover:bg-buzz-yellow/20",
            MOTION.transitionColors,
            focusRingClass,
          )}
        >
          Today, {MONTH_SHORT_NAMES[today.month]} {today.day}
        </button>

        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className={cn(
            "grid size-8 place-items-center rounded-full border border-line text-muted hover:border-buzz-yellowLine hover:text-buzz-yellow",
            MOTION.press,
            focusRingClass,
          )}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <h3 className="text-buzzH3 font-medium text-primary">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h3>
        {mode === "range" && (
          <span className="text-buzzLabel text-muted">
            {startIso && endIso
              ? "Range set"
              : startIso
                ? "Pick the end"
                : "Pick the start"}
          </span>
        )}
      </div>

      <div className="mt-1 grid grid-cols-7 text-center text-buzzLabel text-muted">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1.5">
            {label}
          </span>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`${MONTH_NAMES[viewMonth]} ${viewYear}`}
        className="grid grid-cols-7"
        onMouseLeave={() => onHoverDate?.(null)}
      >
        {days.map((cell) => {
          const endpoint = isEndpoint(cell);
          const span = inSpan(cell);
          const showBar = span && mode === "range";
          const todayRing = cell.isoString === todayIso && !endpoint;
          const first = span && (cell.isoString === bounds!.lo || cell.date.getDay() === 0);
          const last = span && (cell.isoString === bounds!.hi || cell.date.getDay() === 6);
          const dimmed = !cell.isCurrentMonth && !endpoint && !span;

          return (
            <button
              key={cell.isoString}
              type="button"
              role="gridcell"
              data-iso={cell.isoString}
              disabled={cell.isDisabled}
              aria-label={cell.date.toLocaleDateString("en-US", { dateStyle: "full" })}
              aria-selected={endpoint}
              onClick={() => onSelect(cell.isoString)}
              onMouseEnter={() => {
                if (mode === "range" && startIso && !endIso) {
                  onHoverDate?.(cell.isoString);
                }
              }}
              onKeyDown={(event) => handleKeyDown(event, cell)}
              className={cn(
                // 40px cell with the 32px circle centered, leaving 4px above and
                // below. There is no caption row: the today ring alone marks the
                // current day.
                "group/day relative isolate flex h-10 items-center justify-center text-buzzLabel outline-none",
                cell.isDisabled
                  ? "cursor-not-allowed opacity-25"
                  : "cursor-pointer",
                dimmed ? "text-quiet" : "text-primary",
                focusRingClass,
              )}
            >
              {showBar && (
                <span
                  aria-hidden
                  className={cn(
                    // Matches the circle band exactly: a 32px circle centered
                    // in a 40px cell starts 4px from the top.
                    "absolute left-0 right-0 top-[4px] h-8 -z-10 bg-accent-wash",
                    first && "rounded-l-full",
                    last && "rounded-r-full",
                  )}
                />
              )}
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full",
                  "font-normal transition-colors duration-150 motion-reduce:transition-none",
                  // Hover always bolds the numeral, including days already
                  // inside a selected range where the wash gives no feedback.
                  "group-hover/day:font-medium",
                  endpoint && "bg-buzz-yellow font-medium text-on-accent",
                  !endpoint && span && "text-buzz-yellow",
                  !endpoint &&
                    !span &&
                    !cell.isDisabled &&
                    "hover:bg-accent-wash hover:text-buzz-yellow",
                  todayRing && "ring-1 ring-inset ring-buzz-yellow text-buzz-yellow",
                )}
              >
                {cell.day}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
