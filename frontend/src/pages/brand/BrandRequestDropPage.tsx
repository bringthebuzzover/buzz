/**
 * `/brand/requests/new` — Request a Drop. POSTs to /api/brands/me/drops.
 */
import { type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useCreateBrandDrop } from "../../api/hooks/useBrandHooks";

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

/** POST /api/brands/me/drops. */
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
  return <ApiRequestDrop />;
}
