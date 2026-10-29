/**
 * `/brand/requests/new` — Request a Drop. POSTs to /api/brands/me/drop-requests.
 *
 * Two fields are required (message, product). The rest are optional details.
 * A short "What happens next" panel replaces any live preview: the brand does
 * not control the drop title or cover from this form.
 */
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCreateBrandDropRequest,
  type BrandDropRequestDraft,
} from "../../api/hooks/useBrandHooks";
import PageShell from "../../components/site/PageShell";
import { Card, CardHeader } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { userFacingApiError } from "../../api/userFacingError";
import {
  Button,
  ErrorBanner,
  Notice,
  TextArea,
  TextField,
} from "../../components/forms/controls";
import { STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/** Optional leading #, then 1–100 letters, numbers, or underscores. */
const HASHTAG_RE = /^#?[A-Za-z0-9_]{1,100}$/;

const HASHTAG_ERROR =
  "Use 1–100 letters, numbers, or underscores. A leading # is optional.";

const NEXT_STEPS = [
  {
    title: "We read your request",
    body: "A BUZZ representative reviews it and reaches out by email.",
  },
  {
    title: "We plan it together",
    body: "On a call we agree on product, campuses, timing and pricing.",
  },
  {
    title: "BUZZ builds the drop",
    body: "We set it up and publish it. Track it under Requests on your dashboard.",
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
  return <span className="font-normal text-quiet"> (optional)</span>;
}

function WhatHappensNext() {
  return (
    <aside className={cn(STACK.default, "lg:w-[400px] lg:shrink-0")}>
      <Card kind="panel" pad="card">
        <CardHeader title="What happens next" className="mb-5" />
        <ol className="flex flex-col gap-4">
          {NEXT_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-on-accent"
                aria-hidden
              >
                {index + 1}
              </span>
              <div>
                <p className={cn(TEXT.body, "font-medium text-primary")}>{step.title}</p>
                <p className={cn(TEXT.body, "mt-1 text-quiet")}>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <Notice tone="accent">Only the first two fields are required.</Notice>
    </aside>
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
  const errorFor = (key: string) => fieldMessage(clientErrors, serverFieldErrors, key);

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

  const optional = (label: string) => (
    <>
      {label}
      <OptionalMark />
    </>
  );

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <form className={cn("min-w-0 flex-1", STACK.group)} onSubmit={handleSubmit}>
        {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}
        <Card kind="panel" pad="card" className="flex flex-col gap-5">
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
            placeholder="e.g. Launching our cold brew this fall; want orgs to sample it at tailgates"
            error={errorFor("message")}
          />
          <TextArea
            id="product"
            name="product"
            label="What you're sending"
            required
            rows={3}
            placeholder="e.g. 200 cans of cold brew + branded koozies"
            error={errorFor("product")}
          />
        </Card>

        <Card kind="panel" pad="card" className="flex flex-col gap-5">
          <CardHeader
            title="Details"
            description="All optional. Leave anything blank if you are not sure yet."
            className="mb-0"
          />
          <TextField
            id="title"
            name="title"
            label={optional("Title")}
            maxLength={120}
            placeholder="e.g. Fall Cold Brew Launch"
            hint="A short name for your Requests list. BUZZ sets the final drop title."
            error={errorFor("title")}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="location"
              name="location"
              label={optional("Campuses or area")}
              maxLength={255}
              placeholder="e.g. Sample University, or Anywhere"
              error={errorFor("location")}
            />
            <TextField
              id="targetDate"
              name="targetDate"
              type="date"
              label={optional("When do you want this live?")}
              min={minDate}
              max={maxDate}
              hint="Dates are UTC."
              error={errorFor("targetDate")}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="orgCount"
              name="orgCount"
              type="number"
              min={1}
              max={200}
              label={optional("How many organizations?")}
              placeholder="e.g. 8"
              error={errorFor("orgCount")}
            />
            <TextField
              id="unitsPerOrg"
              name="unitsPerOrg"
              type="number"
              min={1}
              max={10000}
              label={optional("Units per organization")}
              placeholder="e.g. 24"
              error={errorFor("unitsPerOrg")}
            />
          </div>
          <TextField
            id="campaignHashtag"
            name="campaignHashtag"
            label={optional("Campaign hashtag")}
            placeholder="e.g. SampleFallBrew (no # needed)"
            error={errorFor("campaignHashtag")}
          />
          <TextArea
            id="notes"
            name="notes"
            label={optional("Anything else")}
            rows={3}
            maxLength={4000}
            placeholder="e.g. Links to brand assets, launches, campuses you care about"
            error={errorFor("notes")}
          />
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting} data-testid="submit-drop-request">
            {submitting ? "Sending..." : "Send request"}
          </Button>
        </div>
      </form>
      <WhatHappensNext />
    </div>
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
    <PageShell width="wide">
      <PageHeader
        kicker="Brand Portal"
        title="Request a drop"
        description="Tell us what you want to run. BUZZ handles the setup with you."
        className="mb-10"
      />
      {apiError.banner ? (
        <div className="mb-6">
          <ErrorBanner>{apiError.banner}</ErrorBanner>
        </div>
      ) : null}
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
