/**
 * `/brand/requests/new` — Request a Drop. The brand fills in title + short message;
 * submission creates a new `Drop` row with `request_received` and
 * seeds `scheduledTransitions[]` so the demo clock advances it through the
 * tracker stages automatically. Then redirects to the drop detail page.
 *
 * In the spec this is the entry to the sales-led handoff (PRODUCT.md §5.1) — the
 * UI mimics that by showing a "we'll take it from here" success copy on the
 * detail page, while the demo clock simulates Buzz acting on it.
 */
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import type { Drop, ScheduledTransition } from "../../types/drop";
import { useMockData } from "../../contexts/MockDataContext";
import { DEMO_BRAND_ID } from "../../data/seed/seedBrands";
import aboutBackground from "../../assets/aboutBackground.png";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Demo schedule: walks the new drop through every tracker stage on a short loop. */
function buildDemoSchedule(): ScheduledTransition[] {
  return [
    { offsetMs: 20_000, toStage: "finalizing_agreements" },
    {
      offsetMs: 40_000,
      toStage: "awaiting_products",
      assignTrackingNumber: `1Z999BUZZ${Math.floor(Math.random() * 9_000_000) + 1_000_000}`,
    },
    { offsetMs: 60_000, toStage: "drop_active" },
    { offsetMs: 120_000, toStage: "drop_finished" },
  ];
}

function generateDropId(): string {
  return `drop-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export default function BrandRequestDropPage() {
  const navigate = useNavigate();
  const { insertDrop, recordTrackerEvent } = useMockData();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    const now = Date.now();
    const drop: Drop = {
      id: generateDropId(),
      brandId: DEMO_BRAND_ID,
      brandName: "Poppi",
      title: title || "Untitled drop",
      description:
        description ||
        "A new campus activation. We'll be in touch with the details shortly.",
      image: aboutBackground,
      location: "Multiple Campuses",
      capacityTotal: 10,
      applyOpenAt: now + 1 * MS_PER_DAY,
      applyCloseAt: now + 8 * MS_PER_DAY,
      manualReopen: false,
      brandTrackerStage: "request_received",
      createdAt: now,
      scheduledTransitions: buildDemoSchedule(),
    };

    insertDrop(drop);
    recordTrackerEvent({
      id: `evt-${drop.id}-request_received`,
      dropId: drop.id,
      stage: "request_received",
      occurredAt: now,
    });

    navigate(`/brand/drops/${drop.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <Link
        to="/brand/dashboard"
        className="mb-6 flex items-center text-sm font-bold text-buzz-inkMuted transition hover:text-buzz-coral"
      >
        <ChevronLeft size={16} className="mr-1" />
        Back to dashboard
      </Link>

      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold text-buzz-coral">
          Request a Drop
        </h2>
        <p className="text-sm font-medium text-buzz-inkMuted">
          Tell us about the drop you want to run. A Buzz rep will take it from
          here — you'll see status updates appear automatically.
        </p>
      </div>

      <form className="space-y-6" onSubmit={onSubmit}>
        <div className="space-y-6 rounded-xl border border-buzz-lineMid bg-buzz-paper p-8 shadow-sm">
          <div>
            <label
              htmlFor="title"
              className="mb-2 block text-sm font-bold text-buzz-inkMuted"
            >
              Working title
            </label>
            <input
              id="title"
              name="title"
              required
              type="text"
              placeholder="e.g. Poppi Spring Pop-Up"
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-bold text-buzz-inkMuted"
            >
              Short message
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={4}
              placeholder="Share a short note about this drop and your goals."
              className="w-full resize-none rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg border-2 border-buzz-coral bg-buzz-coral py-4 text-lg font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit Request"}
        </button>
      </form>
    </div>
  );
}
