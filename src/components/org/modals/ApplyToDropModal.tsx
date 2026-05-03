/**
 * Apply (or Join Waitlist) modal — writes a `DropApplication` row to the
 * mock store. Reframed from the legacy `ApplyModal`: drops the per-org IG
 * sharing copy (the brand-side surface no longer shows org breakdowns) and
 * instead surfaces a clear pitch field plus capacity/window context.
 *
 * Mode is determined by `mode`: `"apply"` writes `decision: "applied"`,
 * `"waitlist"` writes `decision: "waitlisted"`. Both routes the user to
 * `/org/campaigns` on success so they can see their new participation.
 */
import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Drop } from "../../../types/drop";
import { useMockData } from "../../../contexts/MockDataContext";
import { DEMO_ORG_ID } from "../../../data/seed/seedOrgs";

type Mode = "apply" | "waitlist";

type ApplyToDropModalProps = {
  drop: Drop;
  mode: Mode;
  onClose: () => void;
};

function generateId(): string {
  return `app-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export default function ApplyToDropModal({
  drop,
  mode,
  onClose,
}: ApplyToDropModalProps) {
  const [pitch, setPitch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { insertApplication } = useMockData();

  const isWaitlist = mode === "waitlist";
  const heading = isWaitlist
    ? `Join the waitlist for ${drop.title}`
    : `Apply to ${drop.title}`;
  const cta = isWaitlist ? "Join Waitlist" : "Submit Application";

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    insertApplication({
      id: generateId(),
      dropId: drop.id,
      orgId: DEMO_ORG_ID,
      decision: isWaitlist ? "waitlisted" : "applied",
      appliedAt: Date.now(),
      pitch: pitch.trim() || undefined,
    });

    onClose();
    navigate("/org/campaigns");
  };

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
          <h2 className="text-lg font-bold text-buzz-coral">{heading}</h2>
          <p className="mt-1 text-xs font-medium text-buzz-inkMuted">
            {isWaitlist
              ? "Spots are filled. We'll bump you to accepted if a spot opens up."
              : `Tell ${drop.brandName} why your org would be a great fit.`}
          </p>
        </div>

        <form className="space-y-4 p-6" onSubmit={onSubmit}>
          <div className="rounded-xl border border-buzz-lineMid bg-buzz-butter p-4 text-sm font-medium text-buzz-inkMuted shadow-sm">
            <p>
              <span className="font-bold text-buzz-ink">Capacity:</span>{" "}
              {drop.capacityTotal} orgs total
            </p>
            <p className="mt-1">
              <span className="font-bold text-buzz-ink">Apply window:</span>{" "}
              {new Date(drop.applyOpenAt).toLocaleDateString()} —{" "}
              {new Date(drop.applyCloseAt).toLocaleDateString()}
            </p>
          </div>

          <div>
            <label
              htmlFor="apply-pitch"
              className="mb-1 block text-xs font-bold text-buzz-inkMuted"
            >
              Why is your org a good fit?{" "}
              <span className="font-medium normal-case text-buzz-inkFaint">
                (optional)
              </span>
            </label>
            <textarea
              id="apply-pitch"
              rows={4}
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              placeholder="Share your audience, prior activations, or event ideas."
              className="w-full resize-none rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg border-2 border-buzz-coral bg-buzz-coral py-3 font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting…" : cta}
          </button>
        </form>
      </div>
    </div>
  );
}
