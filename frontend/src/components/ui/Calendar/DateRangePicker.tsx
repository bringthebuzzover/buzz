/**
 * DateRangePicker — the range layer.
 *
 * Same base as the other two: `PickerField` chrome + `CalendarGrid` in range
 * mode + two `TimePopover`s for the endpoint clocks. A single month is
 * shown on purpose; the reference's two-month spread was the main complaint.
 *
 * Nothing is committed until **Apply**, so a half-finished range never leaks
 * into the form. The value shape is the pair the forms already use:
 * `{ start, end }`, each `YYYY-MM-DDTHH:mm`.
 */
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { cn } from "../../../theme/cn";
import { MOTION } from "../../../theme/motion";
import { focusRingClass } from "../../../theme/controls";
import { PickerField, type ControlSize } from "./PickerField";
import { CalendarGrid } from "./CalendarGrid";
import { TimePopover } from "./TimePopover";
import {
  MONTH_SHORT_NAMES,
  countDaysInclusive,
  compareISO,
  formatISODate,
  getTodayParts,
  padZero,
  parseISODateTime,
} from "./calendarUtils";

export interface DateRange {
  start: string;
  end: string;
}

export interface DateRangePickerProps {
  id?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Committed range, `YYYY-MM-DDTHH:mm` endpoints. */
  value?: DateRange | null;
  defaultValue?: DateRange | null;
  onChange?: (range: DateRange | null) => void;
  min?: string;
  max?: string;
  size?: ControlSize;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

const DEFAULT_TIME: Record<"start" | "end", string> = {
  start: "09:00",
  end: "23:45",
};

const splitEndpoint = (iso: string | undefined, fallbackTime: string) => {
  const parts = parseISODateTime(iso);
  if (!parts) return { date: null as string | null, time: fallbackTime };
  return {
    date: formatISODate(parts.year, parts.month, parts.day),
    time: `${padZero(parts.hours)}:${padZero(parts.minutes)}`,
  };
};

const shortDate = (iso: string | null) => {
  if (!iso) return "No date";
  const [, month, day] = iso.split("-").map(Number);
  return `${MONTH_SHORT_NAMES[month - 1]} ${day}`;
};

const clock = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${padZero(m)} ${suffix}`;
};

export function DateRangePicker({
  id,
  label,
  hint,
  error,
  value,
  defaultValue = null,
  onChange,
  min,
  max,
  size = "default",
  disabled = false,
  required = false,
  placeholder = "Select a date range",
  className,
  "data-testid": testId,
}: DateRangePickerProps) {
  const committed = value !== undefined ? value : defaultValue;
  const [isOpen, setIsOpen] = useState(false);

  // Draft lives in the panel; Apply promotes it. Reverts to the committed pair
  // every time the panel opens, so Cancel/Escape really cancel.
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(DEFAULT_TIME.start);
  const [endTime, setEndTime] = useState(DEFAULT_TIME.end);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const start = splitEndpoint(committed?.start, DEFAULT_TIME.start);
    const end = splitEndpoint(committed?.end, DEFAULT_TIME.end);
    setStartDate(start.date);
    setEndDate(end.date);
    setStartTime(start.time);
    setEndTime(end.time);
    setHoverDate(null);
  }, [isOpen, committed?.start, committed?.end]);

  const count = useMemo(
    () => (startDate && endDate ? countDaysInclusive(startDate, endDate) : 0),
    [startDate, endDate],
  );

  const invalidSameDay =
    !!startDate && !!endDate && compareISO(startDate, endDate) === 0 && endTime < startTime;
  const canApply = count > 0 && !invalidSameDay;

  const handleSelect = (iso: string) => {
    if (!startDate || endDate) {
      setStartDate(iso);
      setEndDate(null);
      setHoverDate(null);
      return;
    }
    if (compareISO(iso, startDate) < 0) {
      setEndDate(startDate);
      setStartDate(iso);
    } else {
      setEndDate(iso);
    }
    setHoverDate(null);
  };

  const apply = () => {
    if (!startDate || !endDate) return;
    onChange?.({
      start: `${startDate}T${startTime}`,
      end: `${endDate}T${endTime}`,
    });
    setIsOpen(false);
  };

  const clearDraft = () => {
    setStartDate(null);
    setEndDate(null);
    setHoverDate(null);
    setStartTime(DEFAULT_TIME.start);
    setEndTime(DEFAULT_TIME.end);
  };

  const display = useMemo(() => {
    const start = splitEndpoint(committed?.start, DEFAULT_TIME.start);
    const end = splitEndpoint(committed?.end, DEFAULT_TIME.end);
    if (!start.date || !end.date) return "";
    return `${shortDate(start.date)} – ${shortDate(end.date)}, ${clock(start.time)} – ${clock(end.time)}`;
  }, [committed?.start, committed?.end]);

  const today = getTodayParts();
  const todayIso = formatISODate(today.year, today.month, today.day);

  return (
    <PickerField
      id={id}
      label={label}
      hint={hint}
      error={error}
      size={size}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      className={className}
      display={display}
      canClear={Boolean(committed)}
      onClear={() => onChange?.(null)}
      open={isOpen}
      onOpenChange={setIsOpen}
      panelClassName="w-[352px]"
    >
      <CalendarGrid
        mode="range"
        rangeStart={startDate}
        rangeEnd={endDate}
        hoverDate={hoverDate}
        onHoverDate={setHoverDate}
        onSelect={handleSelect}
        minDate={min?.slice(0, 10)}
        maxDate={max?.slice(0, 10)}
        initialMonth={startDate ?? todayIso}
      />

      {/*
        Range readout: OPENS … CLOSES …, each with its own time popover.
        The lists no longer expand inline, so opening a clock never reflows
        the panel or pushes the calendar around.
      */}
      <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
        {(["start", "end"] as const).map((endpoint) => {
          const date = endpoint === "start" ? startDate : endDate;
          const time = endpoint === "start" ? startTime : endTime;
          const setTime = endpoint === "start" ? setStartTime : setEndTime;
          return (
            <div key={endpoint} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="text-buzzLabel uppercase tracking-[0.07em] text-muted">
                  {endpoint === "start" ? "Opens" : "Closes"}
                </span>
                <span className={cn("text-buzzSmall", date ? "text-primary" : "text-quiet")}>
                  {date ? shortDate(date) : "—"}
                </span>
              </span>
              <TimePopover
                label={endpoint === "start" ? "Opening time" : "Closing time"}
                triggerLabel={endpoint === "start" ? "Set opening time" : "Set closing time"}
                value={time}
                onChange={setTime}
                disabled={!date}
              />
            </div>
          );
        })}

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={clearDraft}
            className={cn(
              "rounded-buzzControl px-1 text-buzzSmall text-muted hover:text-primary",
              MOTION.press,
              focusRingClass,
            )}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!canApply}
            className={cn(
              "h-9 rounded-full px-4 text-buzzSmall font-medium",
              MOTION.press,
              focusRingClass,
              canApply
                ? "bg-buzz-yellow text-on-accent hover:bg-buzz-yellowHover"
                : "cursor-not-allowed bg-buzz-paper08 text-quiet",
            )}
          >
            {count > 0
              ? `Apply · ${count} ${count === 1 ? "day" : "days"}`
              : "Select dates"}
          </button>
        </div>

        {invalidSameDay && (
          <p className="text-buzzLabel text-buzz-dangerInk">
            Closing time must not precede opening time.
          </p>
        )}
      </div>
    </PickerField>
  );
}
