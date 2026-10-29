import { useMemo, useState } from "react";
import { CalendarPlus, Check } from "lucide-react";
import { REMINDER_CHOICES } from "../../../api/hooks/useDropHooks";
import { Modal } from "../../ui/Modal";
import { Button } from "../../forms/controls";
import { STACK, TEXT } from "../../../theme/tokens";
import { focusRingClass } from "../../../theme/controls";
import { cn } from "../../../theme/cn";

type NotifyMeModalProps = {
  dropTitle: string;
  initialSelection: number[];
  onClose: () => void;
  /** Single lead-time, or null to opt out (DELETE). */
  onConfirm: (selectedMinutes: number | null) => void;
};

/** Display labels keyed by the shared `REMINDER_CHOICES` minute values. */
const REMINDER_LABELS: Record<(typeof REMINDER_CHOICES)[number], string> = {
  60: "1 hour before",
  15: "15 minutes before",
  5: "5 minutes before",
};

/** UI order: longest lead time first. */
const REMINDER_OPTIONS = (
  [...REMINDER_CHOICES] as Array<(typeof REMINDER_CHOICES)[number]>
)
  .sort((a, b) => b - a)
  .map((minutes) => ({ minutes, label: REMINDER_LABELS[minutes] }));

export default function NotifyMeModal({
  dropTitle,
  initialSelection,
  onClose,
  onConfirm,
}: NotifyMeModalProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(
    initialSelection[0] ?? null,
  );

  const summary = useMemo(() => {
    if (selectedMinutes == null) return "No reminder — Confirm to opt out";
    const option = REMINDER_OPTIONS.find((o) => o.minutes === selectedMinutes);
    return option ? option.label : "1 reminder selected";
  }, [selectedMinutes]);

  const handleConfirm = () => {
    onConfirm(selectedMinutes);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title={dropTitle}
      description="Pick one reminder before the drop opens, or confirm with none to opt out."
      size="wide"
    >
      <div className={STACK.default}>
        <p className={cn(TEXT.micro, "text-quiet")}>Reminder timing</p>

        <div className={STACK.tight} role="radiogroup" aria-label="Reminder timing">
          {REMINDER_OPTIONS.map((option) => {
            const selected = selectedMinutes === option.minutes;
            return (
              <button
                key={option.minutes}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  setSelectedMinutes((prev) =>
                    prev === option.minutes ? null : option.minutes,
                  )
                }
                className={cn(
                  "flex w-full items-center justify-between rounded-buzzField border px-4 py-3 text-left text-primary transition",
                  focusRingClass,
                  selected
                    ? "border-buzz-yellowLine bg-accent-wash"
                    : "border-line bg-surface-tile hover:border-primary",
                )}
              >
                <span className={cn(TEXT.body, "font-medium")}>{option.label}</span>
                {selected ? (
                  <span className="rounded-full bg-accent p-1 text-on-accent">
                    <Check size={14} />
                  </span>
                ) : (
                  <span className="h-5 w-5 rounded-full border border-quiet" />
                )}
              </button>
            );
          })}
        </div>

        <Button type="button" fullWidth onClick={handleConfirm}>
          {selectedMinutes == null ? "Confirm — no reminder" : "Confirm reminder"}
        </Button>

        <div className={cn(TEXT.meta, "flex items-center justify-center gap-2")}>
          <CalendarPlus size={14} />
          <span>{summary}</span>
        </div>
      </div>
    </Modal>
  );
}
