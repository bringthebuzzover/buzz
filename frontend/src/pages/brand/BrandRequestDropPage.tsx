/**
 * `/brand/requests/new` — Request a Drop. POSTs to /api/brands/me/drop-requests.
 *
 * Two fields are required (message, product). The rest are optional details.
 * A short "What happens next" panel replaces any live preview: the brand does
 * not control the drop title or cover from this form.
 */
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import {
  useCreateBrandDropRequest,
  type BrandDropRequestDraft,
} from "../../api/hooks/useBrandHooks";
import PageShell from "../../components/site/PageShell";
import { Card, CardHeader } from "../../components/ui/Card";
import { userFacingApiError } from "../../api/userFacingError";
import {
  Button,
  ErrorBanner,
  TextArea,
  TextField,
} from "../../components/forms/controls";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/** Optional leading #, then 1–100 letters, numbers, or underscores. */
const HASHTAG_RE = /^#?[A-Za-z0-9_]{1,100}$/;

const HASHTAG_ERROR =
  "Use 1–100 letters, numbers, or underscores. A leading # is optional.";

const NEXT_STEPS = [
  {
    title: "We read your request",
    body: "A Buzz representative reads this and replies by email.",
  },
  {
    title: "We plan it together",
    body: "We align on campuses, product, timing, and pricing.",
  },
  {
    title: "BUZZ builds the drop",
    body: "You review the draft, then track it from your dashboard.",
  },
] as const;

function optionalText(raw: string): string | undefined {
  const trimmed = raw.trim();
  return trimmed || undefined;
}

function optionalInt(raw: string, label: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number.`);
  }
  return value;
}

function utcIsoDate(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function OptionalMark() {
  return <span className="font-medium text-buzz-inkMuted"> (optional)</span>;
}

function WhatHappensNext() {
  return (
    <Card kind="card" pad="roomy">
      <CardHeader
        title="What happens next"
        description="A representative handles the campaign. This form does not publish a drop."
        className="mb-4"
      />
      <ol className="space-y-4">
        {NEXT_STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-buzz-coral text-xs font-bold text-buzz-paper"
              aria-hidden
            >
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-bold text-buzz-ink">{step.title}</p>
              <p className={cn(TEXT.meta, "mt-0.5")}>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className={cn(TEXT.meta, "mt-4")}>
        Only the first two fields are required.
      </p>
    </Card>
  );
}

function fieldMessage(
  client: Record<string, string>,
  server: Record<string, string>,
  key: string,
): string | undefined {
  return client[key] || server[key] || undefined;
}

function RequestForm({
  onSubmit,
  submitting,
  serverFieldErrors,
}: {
  onSubmit: (body: BrandDropRequestDraft) => void;
  submitting: boolean;
  serverFieldErrors: Record<string, string>;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const minDate = utcIsoDate(0);
  const maxDate = utcIsoDate(365);
  const errorFor = (key: string) =>
    fieldMessage(clientErrors, serverFieldErrors, key);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setClientErrors({});
    const formData = new FormData(e.currentTarget);
    const message = String(formData.get("message") ?? "").trim();
    const product = String(formData.get("product") ?? "").trim();
    const nextErrors: Record<string, string> = {};
    if (!message) {
      nextErrors.message = "Tell us about the campaign.";
    }
    if (!product) {
      nextErrors.product = "Tell us what you're sending.";
    }
    const hashtagRaw = String(formData.get("campaignHashtag") ?? "").trim();
    if (hashtagRaw && !HASHTAG_RE.test(hashtagRaw)) {
      nextErrors.campaignHashtag = HASHTAG_ERROR;
    }
    let orgCount: number | undefined;
    let unitsPerOrg: number | undefined;
    try {
      orgCount = optionalInt(
        String(formData.get("orgCount") ?? ""),
        "How many organizations",
      );
      unitsPerOrg = optionalInt(
        String(formData.get("unitsPerOrg") ?? ""),
        "Units per organization",
      );
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : "Check the numbers and try again.";
      if (messageText.startsWith("How many organizations")) {
        nextErrors.orgCount = messageText;
      } else if (messageText.startsWith("Units per organization")) {
        nextErrors.unitsPerOrg = messageText;
      } else {
        nextErrors.orgCount = messageText;
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setClientErrors(nextErrors);
      if (!message || !product) {
        setFormError("Tell us about the campaign and what you're sending.");
      }
      return;
    }
    const body: BrandDropRequestDraft = { message, product };
    const title = optionalText(String(formData.get("title") ?? ""));
    const location = optionalText(String(formData.get("location") ?? ""));
    const targetDate = optionalText(String(formData.get("targetDate") ?? ""));
    const notes = optionalText(String(formData.get("notes") ?? ""));
    if (title) body.title = title;
    if (location) body.location = location;
    if (targetDate) body.targetDate = targetDate;
    if (orgCount !== undefined) body.orgCount = orgCount;
    if (unitsPerOrg !== undefined) body.unitsPerOrg = unitsPerOrg;
    if (hashtagRaw) body.campaignHashtag = hashtagRaw;
    if (notes) body.notes = notes;
    onSubmit(body);
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

      {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
          <Card kind="card" pad="roomy" className="space-y-6">
            <CardHeader
              title="The campaign"
              description="The two things we need to start."
              className="mb-0"
            />
            <TextArea
              id="message"
              name="message"
              label="Tell us about the campaign"
              required
              rows={4}
              placeholder="Share goals, timing, or anything a rep should know."
              error={errorFor("message")}
            />
            <TextArea
              id="product"
              name="product"
              label="What you're sending"
              required
              rows={3}
              placeholder="e.g. One case of cold brew in branded boxes"
              error={errorFor("product")}
            />
          </Card>
          <WhatHappensNext />
        </div>

        <Card kind="card" pad="roomy" className="space-y-6">
          <CardHeader
            title="Details"
            description="All optional. Leave a field blank if you're not sure."
            className="mb-0"
          />
          <TextField
            id="title"
            name="title"
            label={
              <>
                Title
                <OptionalMark />
              </>
            }
            maxLength={120}
            placeholder="e.g. Fall Cold Brew Launch"
            error={errorFor("title")}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField
              id="location"
              name="location"
              label={
                <>
                  Campuses or area
                  <OptionalMark />
                </>
              }
              maxLength={255}
              placeholder="e.g. Sample University, or Anywhere"
              error={errorFor("location")}
            />
            <div>
              <TextField
                id="targetDate"
                name="targetDate"
                type="date"
                label={
                  <>
                    When do you want this live?
                    <OptionalMark />
                  </>
                }
                min={minDate}
                max={maxDate}
                error={errorFor("targetDate")}
                aria-describedby="targetDate-hint"
              />
              <p id="targetDate-hint" className={cn(TEXT.meta, "mt-1")}>
                Dates are UTC.
              </p>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField
              id="orgCount"
              name="orgCount"
              type="number"
              min={1}
              max={200}
              label={
                <>
                  How many organizations
                  <OptionalMark />
                </>
              }
              placeholder="e.g. 8"
              error={errorFor("orgCount")}
            />
            <TextField
              id="unitsPerOrg"
              name="unitsPerOrg"
              type="number"
              min={1}
              max={10000}
              label={
                <>
                  Units per organization
                  <OptionalMark />
                </>
              }
              placeholder="e.g. 24"
              error={errorFor("unitsPerOrg")}
            />
          </div>
          <TextField
            id="campaignHashtag"
            name="campaignHashtag"
            label={
              <>
                Campaign hashtag
                <OptionalMark />
              </>
            }
            placeholder="e.g. FallColdBrew"
            error={errorFor("campaignHashtag")}
          />
          <TextArea
            id="notes"
            name="notes"
            label={
              <>
                Anything else
                <OptionalMark />
              </>
            }
            rows={3}
            maxLength={4000}
            placeholder="Links to brand assets, or anything that didn't fit above."
            error={errorFor("notes")}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={submitting}
              data-testid="submit-drop-request"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </Card>
      </form>
    </>
  );
}

/** POST /api/brands/me/drop-requests. */
function ApiRequestDrop() {
  const navigate = useNavigate();
  const mutation = useCreateBrandDropRequest();

  const handleSubmit = (body: BrandDropRequestDraft) => {
    mutation.mutate(body, {
      onSuccess: () => {
        navigate("/brand/dashboard#tickets", {
          state: { ticketSubmitted: true },
        });
      },
    });
  };

  const apiError = mutation.isError
    ? userFacingApiError(
        mutation.error,
        "Couldn’t submit your request. Please try again.",
      )
    : { fields: {}, banner: null };

  return (
    <PageShell width="portal">
      {apiError.banner ? <ErrorBanner>{apiError.banner}</ErrorBanner> : null}
      <RequestForm
        onSubmit={handleSubmit}
        submitting={mutation.isPending}
        serverFieldErrors={apiError.fields}
      />
    </PageShell>
  );
}

export default function BrandRequestDropPage() {
  return <ApiRequestDrop />;
}
