/**
 * `/brand/requests/new` — Request a Drop. POSTs to /api/brands/me/drop-requests.
 */
import { type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useCreateBrandDropRequest } from "../../api/hooks/useBrandHooks";

function RequestForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (message: string, notes: string) => void;
  submitting: boolean;
}) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const formData = new FormData(e.currentTarget);
    onSubmit(
      String(formData.get("message") ?? "").trim(),
      String(formData.get("notes") ?? "").trim(),
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
          Tell us what you want to run. A Buzz representative will contact you
          to plan the campaign — this is not a live drop yet.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-6 rounded-xl border border-buzz-lineMid bg-buzz-paper p-8 shadow-sm">
          <div>
            <label
              htmlFor="message"
              className="mb-2 block text-sm font-bold text-buzz-inkMuted"
            >
              Message
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={4}
              placeholder="Share goals, campuses, timing, or anything a rep should know."
              className="w-full resize-none rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
          <div>
            <label
              htmlFor="notes"
              className="mb-2 block text-sm font-bold text-buzz-inkMuted"
            >
              Notes <span className="font-medium">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Extra context for the sales call."
              className="w-full resize-none rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          data-testid="submit-drop-request"
          className="w-full rounded-lg border-2 border-buzz-coral bg-buzz-coral py-4 text-lg font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </form>
    </div>
  );
}

/** POST /api/brands/me/drop-requests. */
function ApiRequestDrop() {
  const navigate = useNavigate();
  const mutation = useCreateBrandDropRequest();

  const handleSubmit = (message: string, notes: string) => {
    mutation.mutate(
      {
        message,
        ...(notes ? { notes } : {}),
      },
      {
        onSuccess: () => {
          navigate("/brand/dashboard#tickets", {
            state: { ticketSubmitted: true },
          });
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
            : "Couldn’t submit your request. Please try again."}
        </div>
      ) : null}
      <RequestForm onSubmit={handleSubmit} submitting={mutation.isPending} />
    </>
  );
}

export default function BrandRequestDropPage() {
  return <ApiRequestDrop />;
}
