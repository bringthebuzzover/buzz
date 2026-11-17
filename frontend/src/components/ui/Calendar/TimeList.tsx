/**
 * The one clock every picker builds on.
 *
 * A scrolling 15-minute column for the current half of the day, plus the
 * stacked AM/PM toggle — the two pieces of the reference time panel. It holds
 * no chrome of its own so the date+time picker and the range footer can wrap
 * it in whatever frame they need.
 */
import { useEffect, useRef } from "react";
import { cn } from "../../../theme/cn";
import { MOTION } from "../../../theme/motion";
import { focusRingClass } from "../../../theme/controls";
import { from24Hour, padZero, to24Hour } from "./calendarUtils";

export interface TimeListProps {
  /** 24-hour time, HH:mm. */
  value: string;
  onChange: (time24: string) => void;
  /** Minute granularity in the list. Defaults to 15. */
  step?: number;
  className?: string;
  /** Rendered height of the scrolling column. */
  heightClass?: string;
  /** Tighter column and AM/PM widths, for the range footer. */
  compact?: boolean;
}

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const buildTimes = (ampm: "AM" | "PM", step: number) => {
  const times: { label: string; hour12: number; minutes: number }[] = [];
  const minutes: number[] = [];
  for (let m = 0; m < 60; m += step) minutes.push(m);
  for (const hour12 of HOURS_12) {
    for (const minute of minutes) {
      times.push({ label: `${padZero(hour12)}:${padZero(minute)}`, hour12, minutes: minute });
    }
  }
  return { ampm, times };
};

export function TimeList({
  value,
  onChange,
  step = 15,
  className,
  heightClass = "h-[196px]",
  compact = false,
}: TimeListProps) {
  const parsed = value.match(/^(\d{1,2}):(\d{2})/);
  const hours24 = parsed ? Math.min(23, parseInt(parsed[1], 10)) : 12;
  const minutesNow = parsed ? Math.min(59, parseInt(parsed[2], 10)) : 0;
  const { hour12, ampm } = from24Hour(hours24);

  const listRef = useRef<HTMLDivElement>(null);
  const { times } = buildTimes(ampm, step);

  /**
   * Times that are not on the grid (e.g. 8:52 from legacy data) get their own
   * row, so the list always shows something selected. Without this the list
   * read as "nothing picked" for any off-grid value.
   */
  const isOnGrid = minutesNow % step === 0;
  const rows = isOnGrid
    ? times
    : [...times, { label: `${padZero(hour12)}:${padZero(minutesNow)}`, hour12, minutes: minutesNow }]
        .sort((a, b) => a.hour12 * 60 + a.minutes - (b.hour12 * 60 + b.minutes));

  // Center the active time whenever the panel opens or the half-day changes.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    if (!active) return;
    list.scrollTop = Math.max(
      0,
      active.offsetTop - list.offsetTop - (list.clientHeight - active.clientHeight) / 2,
    );
  }, [ampm, step, value]);

  const selectTime = (h12: number, minute: number, nextAmpm: "AM" | "PM" = ampm) => {
    onChange(`${padZero(to24Hour(h12, nextAmpm))}:${padZero(minute)}`);
  };

  return (
    <div className={cn("flex", compact ? "gap-2" : "gap-2.5", className)}>
      <div
        ref={listRef}
        role="listbox"
        aria-label={`Times in the ${ampm === "AM" ? "morning" : "afternoon and evening"}, every ${step} minutes`}
        className={cn(
          // Narrow on purpose: the widest entry is "11:45" (5 characters at
          // 12px), so a fixed ~5.5rem column keeps the yellow pill hugging its
          // label instead of stretching across a 256px track.
          "shrink-0 overflow-y-auto overscroll-contain rounded-buzzField border border-line bg-buzz-paper04 p-1",
          "[scrollbar-color:rgba(240,240,240,0.22)_transparent] [scrollbar-width:thin]",
          compact ? "w-[5.25rem]" : "w-[5.75rem]",
          heightClass,
        )}
      >
        {rows.map((time) => {
          const selected = time.hour12 === hour12 && time.minutes === minutesNow;
          return (
            <button
              key={time.label}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={`${time.label} ${ampm}`}
              onClick={() => selectTime(time.hour12, time.minutes)}
              className={cn(
                "flex h-8 w-full items-center justify-center rounded-buzzControl text-buzzLabel tabular-nums",
                MOTION.transitionColors,
                focusRingClass,
                selected
                  ? "bg-buzz-yellow font-medium text-on-accent"
                  : "text-muted hover:bg-accent-wash hover:text-buzz-yellow",
              )}
            >
              {time.label}
            </button>
          );
        })}
      </div>

      <div
        role="group"
        aria-label="AM or PM"
        className={cn("flex flex-col gap-1.5", compact ? "w-9" : "w-11")}
      >
        {(["AM", "PM"] as const).map((period) => {
          const active = period === ampm;
          return (
            <button
              key={period}
              type="button"
              aria-pressed={active}
              onClick={() => selectTime(hour12, minutesNow, period)}
              className={cn(
                "h-9 rounded-buzzField border text-buzzLabel",
                MOTION.transitionColors,
                focusRingClass,
                active
                  ? "border-buzz-yellow bg-buzz-yellow font-medium text-on-accent"
                  : "border-line bg-buzz-paper04 text-muted hover:border-buzz-yellowLine hover:text-buzz-yellow",
              )}
            >
              {period}
            </button>
          );
        })}
      </div>
    </div>
  );
}
