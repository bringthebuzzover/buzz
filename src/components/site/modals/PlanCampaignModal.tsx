/**
 * Brand dashboard modal: collect campaign interest; demo submit shows confirmation only.
 */
import { X } from "lucide-react";

type PlanCampaignModalProps = {
  onClose: () => void;
};

export default function PlanCampaignModal({ onClose }: PlanCampaignModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-buzz-overlay/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-campaign-heading"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-buzz-lineMid bg-buzz-paper shadow-buzzLg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-buzz-line bg-buzz-cream p-1 text-buzz-inkFaint shadow-sm transition hover:text-buzz-coral"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="border-b border-buzz-line bg-buzz-cream p-6 pr-14">
          <h2
            id="plan-campaign-heading"
            className="text-xl font-bold text-buzz-coral"
          >
            Plan your Campaign
          </h2>
          <p className="mt-2 text-sm font-medium text-buzz-inkMuted">
            Tell us a bit about what you have in mind. A Buzz consultant will
            contact you to plan your campus{" "}
            <span className="font-bold text-buzz-ink">activation</span>.
          </p>
        </div>

        <form
          className="space-y-4 bg-buzz-paper p-6"
          onSubmit={(e) => {
            e.preventDefault();
            onClose();
            alert(
              "Thanks! A Buzz consultant will reach out soon to help plan your activation."
            );
          }}
        >
          <div>
            <label
              htmlFor="plan-campaign-title-input"
              className="mb-2 block text-sm font-bold text-buzz-inkMuted"
            >
              Title
            </label>
            <input
              id="plan-campaign-title-input"
              name="title"
              required
              type="text"
              autoComplete="organization-title"
              placeholder="e.g. Spring sampling tour"
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
          <div>
            <label
              htmlFor="plan-campaign-email"
              className="mb-2 block text-sm font-bold text-buzz-inkMuted"
            >
              Email
            </label>
            <input
              id="plan-campaign-email"
              name="email"
              required
              type="email"
              autoComplete="email"
              placeholder="you@brand.com"
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
          <div>
            <label
              htmlFor="plan-campaign-message"
              className="mb-2 block text-sm font-bold text-buzz-inkMuted"
            >
              Short message
            </label>
            <textarea
              id="plan-campaign-message"
              name="message"
              required
              rows={4}
              placeholder="Goals, timing, campuses, or anything else we should know."
              className="w-full resize-y rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
          <button
            type="submit"
            className="mt-2 w-full rounded-lg border-2 border-buzz-coral bg-buzz-coral py-3 font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}
