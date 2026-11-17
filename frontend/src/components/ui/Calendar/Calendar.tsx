/**
 * Calendar — the date-only primitive.
 *
 * `Calendar` is `CalendarGrid` plus a footer (Today / Clear). It is the base
 * layer: `DateTimePicker` and `DateRangePicker` reuse `CalendarGrid` directly
 * and add their own footers, so the month math and the day cells exist once.
 */
import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "../../../theme/cn";
import { MOTION } from "../../../theme/motion";
import { focusRingClass } from "../../../theme/controls";
import { CalendarGrid } from "./CalendarGrid";
import { formatISODate, getTodayParts, parseISODate } from "./calendarUtils";

export interface CalendarProps {
  /** Selected date in YYYY-MM-DD (or full ISO). */
  value?: string | null;
  onChange?: (dateIso: string) => void;
  minDate?: string | null;
  maxDate?: string | null;
  className?: string;
  /** Bottom "Today / Clear" row. */
  showFooter?: boolean;
}

export function Calendar({
  value,
  onChange,
  minDate,
  maxDate,
  className,
  showFooter = true,
}: CalendarProps) {
  const today = useMemo(() => getTodayParts(), []);
  const todayIso = formatISODate(today.year, today.month, today.day);
  const selectedIso = parseISODate(value)
    ? formatISODate(
        parseISODate(value)!.year,
        parseISODate(value)!.month,
        parseISODate(value)!.day,
      )
    : null;

  return (
    <div className={cn("select-none text-primary", className)}>
      <CalendarGrid
        mode="single"
        value={selectedIso}
        onSelect={(iso) => onChange?.(iso)}
        minDate={minDate}
        maxDate={maxDate}
      />

      {showFooter && (
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-buzzLabel">
          <button
            type="button"
            onClick={() => onChange?.(todayIso)}
            className={cn(
              "inline-flex items-center gap-1.5 text-muted hover:text-buzz-yellow",
              MOTION.press,
              focusRingClass,
              "rounded-buzzControl",
            )}
          >
            <RotateCcw className="size-3" />
            Today
          </button>
          {selectedIso && (
            <button
              type="button"
              onClick={() => onChange?.("")}
              className={cn(
                "text-muted hover:text-buzz-dangerInk",
                MOTION.press,
                focusRingClass,
                "rounded-buzzControl",
              )}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
