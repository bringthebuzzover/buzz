import { useMemo, useState } from "react";
import { Bell, CalendarPlus, Check, X } from "lucide-react";

type NotifyMeModalProps = {
  dropTitle: string;
  initialSelection: number[];
  onClose: () => void;
  onConfirm: (selectedMinutes: number[]) => void;
};

const REMINDER_OPTIONS = [
  { minutes: 60, label: "1 hour before" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 5, label: "5 minutes before" },
] as const;

export default function NotifyMeModal({
  dropTitle,
  initialSelection,
  onClose,
  onConfirm,
}: NotifyMeModalProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number[]>(
    initialSelection.length > 0 ? initialSelection : [15]
  );

  const summary = useMemo(() => {
    if (selectedMinutes.length === 0) return "No reminders selected";
    return `${selectedMinutes.length} reminder${
      selectedMinutes.length === 1 ? "" : "s"
    } selected`;
  }, [selectedMinutes]);

  const toggleOption = (minutes: number) => {
    setSelectedMinutes((prev) =>
      prev.includes(minutes)
        ? prev.filter((value) => value !== minutes)
        : [...prev, minutes].sort((a, b) => b - a)
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedMinutes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-buzz-overlay/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-buzz-lineMid bg-buzz-paper shadow-buzzLg">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-buzz-cream p-1 text-buzz-inkFaint transition hover:text-buzz-coral"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="border-b border-buzz-lineMid bg-buzz-cream px-6 py-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-buzz-coral">
            <Bell size={14} />
            Notify Me
          </div>
          <h2 className="text-2xl font-black text-buzz-coral">{dropTitle}</h2>
          <p className="mt-1 text-sm font-medium text-buzz-inkMuted">
            Pick when you want BUZZ reminders before the drop opens.
          </p>
        </div>

        <div className="space-y-4 bg-buzz-butter/60 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-buzz-inkMuted">
            Reminder timing
          </p>

          <div className="space-y-2">
            {REMINDER_OPTIONS.map((option) => {
              const selected = selectedMinutes.includes(option.minutes);
              return (
                <button
                  key={option.minutes}
                  type="button"
                  onClick={() => toggleOption(option.minutes)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                    selected
                      ? "border-buzz-coral bg-buzz-paper text-buzz-ink"
                      : "border-buzz-lineMid bg-buzz-paper text-buzz-ink hover:bg-buzz-cream"
                  }`}
                >
                  <span className="text-base font-bold">{option.label}</span>
                  {selected ? (
                    <span className="rounded-full bg-buzz-coral p-1 text-buzz-paper">
                      <Check size={14} />
                    </span>
                  ) : (
                    <span className="h-5 w-5 rounded-full border border-buzz-inkFaint" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedMinutes.length === 0}
            className="w-full rounded-xl bg-buzz-coral py-3 text-sm font-black uppercase tracking-wide text-buzz-paper transition hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirm reminders
          </button>

          <div className="flex items-center justify-center gap-2 text-xs font-medium text-buzz-inkMuted">
            <CalendarPlus size={14} />
            <span>{summary}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
