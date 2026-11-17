/**
 * DateTimePicker — date plus time, in one glass panel.
 *
 * Layer 3 of the stack: `PickerField` chrome + `CalendarGrid` for the day and
 * `TimeList` for the clock, side by side on desktop and tabbed on a phone.
 */
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "../../../theme/cn";
import { MOTION } from "../../../theme/motion";
import { focusRingClass } from "../../../theme/controls";
import { PickerField, type ControlSize } from "./PickerField";
import { CalendarGrid } from "./CalendarGrid";
import { TimeList } from "./TimeList";
import {
  formatDisplayDateTime,
  formatISODate,
  formatISODateTime,
  getTodayParts,
  padZero,
  parseISODateTime,
} from "./calendarUtils";

export interface DateTimePickerProps {
  id?: string;
  name?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Value formatted as YYYY-MM-DDTHH:mm. */
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { name?: string; value: string } }) => void;
  min?: string;
  max?: string;
  size?: ControlSize;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

export function DateTimePicker({
  id,
  name,
  label,
  hint,
  error,
  value,
  defaultValue = "",
  onChange,
  min,
  max,
  size = "default",
  disabled = false,
  required = false,
  placeholder = "Select date and time",
  className,
  "data-testid": testId,
}: DateTimePickerProps) {
  const [internalValue, setInternalValue] = useState<string>(
    value !== undefined ? value : defaultValue,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<"date" | "time">("date");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== undefined) setInternalValue(value);
  }, [value]);

  const emit = (next: string) => {
    setInternalValue(next);
    onChange?.({ target: { name, value: next } });
  };

  const parsed = parseISODateTime(internalValue);
  const today = getTodayParts();
  const year = parsed?.year ?? today.year;
  const month = parsed?.month ?? today.month;
  const day = parsed?.day ?? today.day;
  const hours = parsed?.hours ?? 9;
  const minutes = parsed?.minutes ?? 0;

  const dateIso = formatISODate(year, month, day);
  const timeIso = `${padZero(hours)}:${padZero(minutes)}`;

  const handleDate = (nextDate: string) => emit(`${nextDate}T${timeIso}`);
  const handleTime = (nextTime: string) => emit(`${dateIso}T${nextTime}`);

  const handleNow = () => {
    const now = new Date();
    emit(
      formatISODateTime(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
      ),
    );
  };

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
      display={parsed ? formatDisplayDateTime(parsed) : ""}
      canClear={Boolean(internalValue)}
      onClear={() => emit("")}
      open={isOpen}
      onOpenChange={setIsOpen}
      panelClassName="w-[min(520px,calc(100vw-2rem))]"
      hiddenInput={
        /* Native input kept for form serialization and E2E fills. */
        <input
          ref={inputRef}
          id={id}
          type="datetime-local"
          name={name}
          value={internalValue}
          min={min}
          max={max}
          required={required}
          disabled={disabled}
          data-testid={testId}
          onChange={(event) => emit(event.target.value)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      }
    >
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2.5 sm:hidden">
        <div className="flex rounded-full border border-line bg-buzz-paper04 p-0.5">
          {(["date", "time"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setTab(kind)}
              className={cn(
                "rounded-full px-3 py-1 text-buzzLabel capitalize",
                MOTION.transitionColors,
                focusRingClass,
                tab === kind
                  ? "bg-buzz-yellow font-medium text-on-accent"
                  : "text-muted hover:text-primary",
              )}
            >
              {kind}
            </button>
          ))}
        </div>
        <span className="text-buzzLabel text-muted">
          {formatDisplayDateTime({ year, month, day, hours, minutes })}
        </span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className={cn("min-w-0 flex-1", tab === "time" && "hidden sm:block")}>
          <CalendarGrid
            mode="single"
            value={dateIso}
            onSelect={handleDate}
            minDate={min?.slice(0, 10)}
            maxDate={max?.slice(0, 10)}
            initialMonth={dateIso}
          />
        </div>

        <div
          className={cn(
            "w-full shrink-0 sm:w-[124px] sm:border-l sm:border-line sm:pl-4",
            tab === "date" && "hidden sm:block",
          )}
        >
          <div className="mb-2 flex items-center gap-1.5 text-buzzLabel text-muted">
            <Clock className="size-3.5 text-buzz-yellow" />
            Time
          </div>
          <TimeList
            value={timeIso}
            onChange={handleTime}
            heightClass="h-[238px]"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <button
          type="button"
          onClick={handleNow}
          className={cn(
            "rounded-buzzControl text-buzzLabel font-medium text-muted hover:text-buzz-yellow",
            MOTION.press,
            focusRingClass,
          )}
        >
          Set to now
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className={cn(
            "h-8 rounded-full bg-buzz-yellow px-4 text-buzzSmall font-medium text-on-accent hover:bg-buzz-yellowHover",
            MOTION.press,
            focusRingClass,
          )}
        >
          Done
        </button>
      </div>

    </PickerField>
  );
}
