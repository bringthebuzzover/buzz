/**
 * `/brand/requests/new` — Request a Drop.
 *
 * Stage 6 (strangler): behind USE_API this page POSTs to /api/brands/me/drops.
 * With the flag off it keeps the original demo behavior (localStorage + demo clock).
 */
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import type { Drop, ScheduledTransition } from "../../types/drop";
import { useMockData } from "../../contexts/MockDataContext";
import { DEMO_BRAND_ID } from "../../data/seed/seedBrands";
import { USE_API } from "../../config/featureFlags";
import { useCreateBrandDrop } from "../../api/hooks/useBrandHooks";
import boxesImage from "../../assets/boxesImage.png";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Demo schedule: walks the new drop through every tracker stage on a short loop. */
function buildDemoSchedule(): ScheduledTransition[] {
  return [
    { offsetMs: 20_000, toStage: "finalizing_agreements" },
    { offsetMs: 40_000, toStage: "awaiting_products" },
    {
      offsetMs: 60_000,
      toStage: "drop_active",
      assignTrackingNumber: `1Z999BUZZ${Math.floor(Math.random() * 9_000_000) + 1_000_000}`,
    },
    { offsetMs: 140_000, toStage: "drop_finished" },
  ];
}

function generateDropId(): string {
  return `drop-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function RequestForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (title: string, description: string) => void;
  submitting: boolean;
}) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const formData = new FormData(e.currentTarget);
    onSubmit(
      String(formData.get("title") ?? "").trim(),
      String(formData.get("description") ?? "").trim(),
    );
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
          here.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-6 rounded-xl border border-buzz-lineMid bg-buzz-paper p-8 shadow-sm">
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-bold text-buzz-inkMuted">
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
            <label htmlFor="description" className="mb-2 block text-sm font-bold text-buzz-inkMuted">
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
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </form>
    </div>
  );
}

/** Demo path: localStorage stores + demo clock transitions. */
function DemoRequestDrop() {
  const navigate = useNavigate();
  const { insertDrop, recordTrackerEvent } = useMockData();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (title: string, description: string) => {
    if (submitting) return;
    setSubmitting(true);

    const now = Date.now();
    const drop: Drop = {
      id: generateDropId(),
      brandId: DEMO_BRAND_ID,
      brandName: "Poppi",
      title: title || "Untitled drop",
      description:
        description ||
        "A new campus activation. We'll be in touch with the details shortly.",
      image: boxesImage,
      location: "Multiple Campuses",
      capacityTotal: 10,
      applyOpenAt: now + 1 * MS_PER_DAY,
      applyCloseAt: now + 8 * MS_PER_DAY,
      manualReopen: false,
      brandTrackerStage: "request_received",
      totalProductUnits: 360,
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

  return <RequestForm onSubmit={handleSubmit} submitting={submitting} />;
}

/** API path: POST /api/brands/me/drops. */
function ApiRequestDrop() {
  const navigate = useNavigate();
  const mutation = useCreateBrandDrop();

  const handleSubmit = (title: string, description: string) => {
    mutation.mutate(
      {
        title: title || "Untitled drop",
        description: description || "A new campus activation.",
      },
      {
        onSuccess: (data) => {
          navigate(`/brand/drops/${data.id}`);
        },
      },
    );
  };

  return (
    <>
      {mutation.isError ? (
        <div className="mx-auto mb-4 max-w-2xl rounded-lg bg-red-50 p-3 text-center text-sm font-medium text-red-700">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Couldn’t create your drop. Please try again."}
        </div>
      ) : null}
      <RequestForm onSubmit={handleSubmit} submitting={mutation.isPending} />
    </>
  );
}

export default function BrandRequestDropPage() {
  return USE_API ? <ApiRequestDrop /> : <DemoRequestDrop />;
}
