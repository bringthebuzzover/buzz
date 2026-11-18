/**
 * TimePicker — the time-only primitive.
 *
 * `TimePicker` is `TimeList` plus a display readout and quick presets. It is
 * the inline/time-only layer; `DateTimePicker` and `DateRangePicker` reuse
 * `TimeList` directly so the scrolling clock is written once.
 */
import { Clock } from "lucide-react";
import { cn } from "../../../theme/cn";
import { MOTION } from "../../../theme/motion";
import { focusRingClass } from "../../../theme/controls";
import { TimeList } from "./TimeList";
import { formatDisplayTime, padZero, to24Hour } from "./calendarUtils";

export interface TimePickerProps {
  /** Time value formatted as HH:mm (24-hour). */
  value?: string | null;
  onChange?: (time: string) => void;
  className?: string;
  /** Quick preset pills under the list. */
  showPresets?: boolean;
}

const PRESETS = [
  { label: "9:00 AM", hours: 9, minutes: 0 },
  { label: "12:00 PM", hours: 12, minutes: 0 },
  { label: "5:00 PM", hours: 17, minutes: 0 },
  { label: "11:59 PM", hours: 23, minutes: 59 },
];

export function TimePicker({
  value,
  onChange,
  className,
  showPresets = true,
}: TimePickerProps) {
  const time = value && /^\d{1,2}:\d{2}/.test(value) ? value.slice(0, 5) : "09:00";
  const [hours, minutes] = time.split(":").map(Number);

  return (
    <div className={cn("select-none text-primary", className)}>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-2.5">
        <span className="flex items-center gap-1.5 text-buzzLabel text-muted">
          <Clock className="size-3.5 text-buzz-yellow" />
          Time
        </span>
        <span className="rounded-buzzControl border border-line bg-buzz-paper04 px-2 py-0.5 text-sm font-medium tabular-nums text-primary">
          {formatDisplayTime(hours, minutes)}
        </span>
      </div>

      <TimeList value={time} onChange={(next) => onChange?.(next)} />

      {showPresets && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() =>
                onChange?.(
                  `${padZero(preset.hours)}:${padZero(preset.minutes)}`,
                )
              }
              className={cn(
                "rounded-full border border-line bg-buzz-paper04 px-2.5 py-1 text-buzzLabel text-muted hover:border-buzz-yellowLine hover:text-buzz-yellow",
                MOTION.transitionColors,
                focusRingClass,
              )}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              onChange?.(`${padZero(now.getHours())}:${padZero(now.getMinutes())}`);
            }}
            className={cn(
              "rounded-full px-2.5 py-1 text-buzzLabel text-buzz-yellow hover:underline",
              MOTION.press,
              focusRingClass,
            )}
          >
            Now
          </button>
        </div>
      )}
    </div>
  );
}

export { to24Hour };
