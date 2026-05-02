/**
 * Student-facing modal from campaign detail: pitch textarea + consent copy for what is shared with the brand.
 */
import { X } from "lucide-react";
import type { Campaign } from "../../../types/campaign";

type ApplyModalProps = {
  /** Campaign the student is applying for (titles the modal and form). */
  campaign: Campaign;
  /** Closes the overlay after submit or cancel. */
  onClose: () => void;
};

/** Binds copy to `campaign.title` / `campaign.brand`; submit is a demo alert then `onClose`. */
export default function ApplyModal({ campaign, onClose }: ApplyModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-buzz-overlay/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-buzz-lineMid bg-buzz-paper shadow-buzzLg">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-buzz-cream p-1 text-buzz-inkFaint hover:text-buzz-coral"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="border-b border-buzz-line bg-buzz-cream p-6">
          <h2 className="text-lg font-bold text-buzz-coral">
            Apply for {campaign.title}
          </h2>
          <p className="mt-1 text-xs font-medium text-buzz-inkMuted">
            Submit your registered group profile to {campaign.brand}.
          </p>
        </div>

        {/* Demo-only: fake application success path before closing. */}
        <form
          className="space-y-4 p-6"
          onSubmit={e => {
            e.preventDefault();
            onClose();
            alert("Application submitted! The brand will review your IG profile.");
          }}
        >
          <div className="mb-4 rounded-xl border border-buzz-lineMid bg-buzz-butter p-4 shadow-sm">
            <p className="mb-2 text-sm font-bold text-buzz-inkMuted">
              Your profile will be shared:
            </p>
            <ul className="space-y-1 text-sm font-bold text-buzz-coral">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-buzz-coral" />
                Organization Name
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-buzz-coral" />
                .edu Email Address
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-buzz-coral" />
                Instagram Profile Preview
              </li>
            </ul>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-buzz-inkMuted">
              Why is your group a good fit for {campaign.brand}?
            </label>
            <textarea
              required
              rows={4}
              placeholder="Tell the brand why your members would love this product and how you plan to run the pop-up event..."
              className="w-full resize-none rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
          <button
            type="submit"
            className="mt-2 w-full rounded-lg border-2 border-buzz-coral bg-buzz-coral py-3 font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
          >
            Submit Application
          </button>
        </form>
      </div>
    </div>
  );
}
