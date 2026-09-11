/**
 * `/brand/requests/new` — Request a Drop. POSTs to /api/brands/me/drop-requests.
 */
import { type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useCreateBrandDropRequest } from "../../api/hooks/useBrandHooks";
import PageShell from "../../components/site/PageShell";
import { Card } from "../../components/ui/Card";
import {
  Button,
  ErrorBanner,
  TextArea,
} from "../../components/forms/controls";

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
    <>
      <Link
        to="/brand/dashboard"
        className="mb-6 flex items-center text-sm font-bold text-buzz-inkMuted transition hover:text-buzz-coral"
      >
        <ChevronLeft size={16} className="mr-1" />
        Back to dashboard
      </Link>

      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-buzz-ink">
          Request a <span className="text-buzz-coral">Drop</span>
        </h1>
        <p className="text-sm font-medium text-buzz-inkMuted">
          Tell us what you want to run. A Buzz representative will contact you
          to plan the campaign — this is not a live drop yet.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card kind="card" pad="roomy" className="space-y-6">
          <TextArea
            id="message"
            name="message"
            label="Message"
            required
            rows={4}
            placeholder="Share goals, campuses, timing, or anything a rep should know."
          />
          <TextArea
            id="notes"
            name="notes"
            label={
              <>
                Notes <span className="font-medium">(optional)</span>
              </>
            }
            rows={3}
            placeholder="Extra context for the sales call."
          />
          <Button
            type="submit"
            fullWidth
            disabled={submitting}
            data-testid="submit-drop-request"
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </Card>
      </form>
    </>
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
    <PageShell width="form">
      {mutation.isError ? (
        <ErrorBanner>
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Couldn’t submit your request. Please try again."}
        </ErrorBanner>
      ) : null}
      <RequestForm onSubmit={handleSubmit} submitting={mutation.isPending} />
    </PageShell>
  );
}

export default function BrandRequestDropPage() {
  return <ApiRequestDrop />;
}
