/**
 * Brand-only modal opened from the dashboard: collects phone for a callback request (demo submit).
 */
import { X } from "lucide-react";

type StrategyCallModalProps = {
  /** Called after submit or when the user dismisses the sheet. */
  onClose: () => void;
};

/** Phone form; on submit shows an alert and calls `onClose` (no backend wiring). */
export default function StrategyCallModal({ onClose }: StrategyCallModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-buzz-overlay/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-buzz-lineMid bg-buzz-paper shadow-buzzLg">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-buzz-line bg-buzz-cream p-1 text-buzz-inkFaint shadow-sm transition hover:text-buzz-coral"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="border-b border-buzz-line bg-buzz-cream p-6">
          <h2 className="text-xl font-bold text-buzz-coral">Book a Strategy Call</h2>
          <p className="mt-2 text-sm font-medium text-buzz-inkMuted">
            Leave your phone number below and a BUZZ representative will call you
            back shortly to help plan your perfect campus campaign.
          </p>
        </div>

        {/* Demo-only: prevents navigation, fires alert, closes modal via `onClose`. */}
        <form
          className="space-y-4 bg-buzz-paper p-6"
          onSubmit={e => {
            e.preventDefault();
            onClose();
            alert("Request submitted! A representative will call you soon.");
          }}
        >
          <div className="rounded-xl border border-buzz-lineMid bg-buzz-butter p-4 text-center shadow-sm">
            <p className="mb-1 text-sm font-bold text-buzz-coral">
              Your profile will be shared
            </p>
            <p className="text-xs font-medium text-buzz-inkMuted">
              Your brand and account details will automatically be shared with our
              representative.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-buzz-inkMuted">
              Phone Number
            </label>
            <input
              required
              type="tel"
              placeholder="(555) 123-4567"
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg border-2 border-buzz-coral bg-buzz-coral py-3 font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
          >
            Request Call
          </button>
        </form>
      </div>
    </div>
  );
}
