/**
 * Brand route `/brand/campaigns/new`: simplified “post campaign” fields; demo submit alerts
 * then navigates back to `/brand`.
 */
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export default function PostCampaignPage() {
  const navigate = useNavigate();

  /** No API call; confirms in an alert and navigates back to the brand dashboard. */
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert("Campaign posted successfully!");
    navigate("/brand");
  };

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <Link
        to="/brand"
        className="mb-6 flex items-center text-sm font-bold text-buzz-inkMuted transition hover:text-buzz-coral"
      >
        <ChevronLeft size={16} className="mr-1" />
        Back to Portal
      </Link>

      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold text-buzz-coral">
          Post a New Campaign
        </h2>
        <p className="text-sm font-medium text-buzz-inkMuted">
          Announce a new product drop or event to our network of campus
          organizations.
        </p>
      </div>

      <form className="space-y-6" onSubmit={onSubmit}>
        <div className="space-y-6 rounded-xl border border-buzz-lineMid bg-buzz-paper p-8 shadow-sm">
          <div>
            <label className="mb-2 block text-sm font-bold text-buzz-inkMuted">
              Campaign Title
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Poppi New Flavor Launch"
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-buzz-inkMuted">
              Target Campuses
            </label>
            <select className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-buzz-inkMuted outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral">
              <option>All Network Campuses</option>
              <option>Ivy League Only</option>
              <option>West Coast Schools</option>
              <option>Select Specific...</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-buzz-inkMuted">
              Campaign Details
            </label>
            <textarea
              required
              rows={5}
              placeholder="Describe the event, what you will send (PR boxes, merch), and what the students need to do..."
              className="w-full resize-none rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full rounded-lg border-2 border-buzz-coral bg-buzz-coral py-4 text-lg font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
        >
          Publish Campaign
        </button>
      </form>
    </div>
  );
}
