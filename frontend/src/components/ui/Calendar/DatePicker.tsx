/**
 * DatePicker — date only, in a glass popover.
 *
 * Layer 2 of the stack: `PickerField` chrome + `Calendar`. Selecting a day
 * closes the popover, because a date is a complete answer on its own.
 */
import { type ReactNode, useEffect, useRef, useState } from "react";
import { PickerField, type ControlSize } from "./PickerField";
import { Calendar } from "./Calendar";
import { formatDisplayDate, parseISODate } from "./calendarUtils";

export interface DatePickerProps {
  id?: string;
  name?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Value formatted as YYYY-MM-DD. */
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

export function DatePicker({
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
  placeholder = "Select date",
  className,
  "data-testid": testId,
}: DatePickerProps) {
  const [internalValue, setInternalValue] = useState<string>(
    value !== undefined ? value : defaultValue,
  );
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== undefined) setInternalValue(value);
  }, [value]);

  const emit = (next: string) => {
    setInternalValue(next);
    onChange?.({ target: { name, value: next } });
  };

  const handleSelect = (isoDate: string) => {
    emit(isoDate);
    setIsOpen(false);
  };

  const parsed = parseISODate(internalValue);

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
      display={parsed ? formatDisplayDate(parsed) : ""}
      canClear={Boolean(internalValue)}
      onClear={() => emit("")}
      open={isOpen}
      onOpenChange={setIsOpen}
      panelClassName="w-[312px]"
      hiddenInput={
        /* Native input kept for form serialization and E2E fills. */
        <input
          ref={inputRef}
          id={id}
          type="date"
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
      <Calendar
        value={internalValue}
        onChange={handleSelect}
        minDate={min}
        maxDate={max}
        showFooter={false}
      />
    </PickerField>
  );
}
