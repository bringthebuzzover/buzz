import { useId, useState } from "react";
import { REMINDER_CHOICES } from "../../../api/hooks/useDropHooks";
import { Modal, ModalActions } from "../../ui/Modal";
import { Button, Radio } from "../../forms/controls";

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

/** UI order: longest lead time first, then the explicit opt-out. */
const REMINDER_OPTIONS: Array<{ minutes: number | null; label: string }> = [
  ...([...REMINDER_CHOICES] as Array<(typeof REMINDER_CHOICES)[number]>)
    .sort((a, b) => b - a)
    .map((minutes) => ({ minutes, label: REMINDER_LABELS[minutes] })),
  { minutes: null, label: "No reminder — Confirm to opt out" },
];

export default function NotifyMeModal({
  dropTitle,
  initialSelection,
  onClose,
  onConfirm,
}: NotifyMeModalProps) {
  const name = useId();
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(
    initialSelection[0] ?? null,
  );

  return (
    <Modal
      onClose={onClose}
      title={dropTitle}
      description="Pick one reminder before the drop opens, or confirm with none to opt out."
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs text-quiet">Reminder timing</legend>
        {REMINDER_OPTIONS.map((option) => (
          <Radio
            key={option.minutes ?? "none"}
            name={name}
            value={option.minutes ?? ""}
            checked={selectedMinutes === option.minutes}
            onChange={() => setSelectedMinutes(option.minutes)}
            label={option.label}
          />
        ))}
      </fieldset>
      <ModalActions onCancel={onClose}>
        <Button
          type="button"
          onClick={() => {
            onConfirm(selectedMinutes);
            onClose();
          }}
        >
          Confirm
        </Button>
      </ModalActions>
    </Modal>
  );
}
