/**
 * ApplyWindowField — the drop form's single "application window" control.
 *
 * Replaces the two separate `DateTimeField`s ("Apply opens" / "Apply closes")
 * with one range picker: two clicks pick the span, `Apply` commits it.
 *
 * The native `datetime-local` inputs are still rendered (hidden, always
 * mounted) because the form contract, `parseDropForm`, and the existing
 * admin tests all read and write them by id/testid. They are the source of
 * truth for the form state; the range picker is the view over them.
 */
import { type ReactNode } from "react";
import { DateRangePicker, type DateRange } from "../ui/Calendar";
import type { ControlSize } from "../ui/Calendar/PickerField";

export interface ApplyWindowFieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  size?: ControlSize;
  disabled?: boolean;
  /** Open id, e.g. `draft-open-at`. */
  openId: string;
  /** Close id, e.g. `draft-close-at`. */
  closeId: string;
  openName?: string;
  closeName?: string;
  openValue: string;
  closeValue: string;
  openTestId?: string;
  closeTestId?: string;
  onChange: (next: { openAt: string; closeAt: string }) => void;
}

export function ApplyWindowField({
  label = "Application window",
  hint,
  size = "compact",
  disabled = false,
  openId,
  closeId,
  openName,
  closeName,
  openValue,
  closeValue,
  openTestId,
  closeTestId,
  onChange,
}: ApplyWindowFieldProps) {
  const value: DateRange | null =
    openValue && closeValue ? { start: openValue, end: closeValue } : null;

  return (
    <div className="relative w-full">
      <DateRangePicker
        id={openId}
        label={label}
        hint={hint}
        size={size}
        disabled={disabled}
        value={value}
        onChange={(range) =>
          onChange({
            openAt: range?.start ?? "",
            closeAt: range?.end ?? "",
          })
        }
      />

      {/*
        Native inputs for form serialization, `parseDropForm`, and tests that
        set values directly. Visually hidden but present in the DOM, exactly as
        the old `DateTimeField`s were.
      */}
      <input
        id={openId}
        name={openName}
        type="datetime-local"
        value={openValue}
        disabled={disabled}
        data-testid={openTestId}
        onChange={(event) => onChange({ openAt: event.target.value, closeAt: closeValue })}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        id={closeId}
        name={closeName}
        type="datetime-local"
        value={closeValue}
        disabled={disabled}
        data-testid={closeTestId}
        onChange={(event) => onChange({ openAt: openValue, closeAt: event.target.value })}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
