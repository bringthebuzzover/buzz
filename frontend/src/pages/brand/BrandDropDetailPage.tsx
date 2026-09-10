/**
 * `/brand/drops/:dropId` — per-drop detail.
 *
 * Renders from the real backend (GET /api/brands/me/drops/:id).
 */
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import BrandDropTrackerStepper from "../../components/brand/BrandDropTrackerStepper";
import ApiDropOrgTable from "../../components/brand/ApiDropOrgTable";
import DropKPISummary from "../../components/brand/DropKPISummary";
import { useBrandDropDetail, useFinalizeApplicants, usePatchBrandDropCreative } from "../../api/hooks/useBrandHooks";
import type { BrandDropDetail, BrandDropApplicant } from "../../api/hooks/useBrandHooks";
import { ApiError } from "../../api/errors";
import { useMemo, useState } from "react";
import { orgCategoryLabel } from "../../types/orgCategory";
import PageShell from "../../components/site/PageShell";
import { Card } from "../../components/ui/Card";
import { StatePanel } from "../../components/ui/StatePanel";
import {
  Button,
  Checkbox,
  ErrorBanner,
  Select,
  SuccessBanner,
  TextArea,
  TextField,
} from "../../components/forms/controls";
import { STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/** Map backend drop detail to the shape components expect. */
function mapDropToView(d: BrandDropDetail) {
  return {
    id: d.id,
    brandId: d.brandId,
    brandName: d.brandName,
    title: d.title,
    description: d.description,
    image: d.image,
    location: d.location,
    capacityTotal: d.capacityTotal,
    applyOpenAt: d.applyOpenAt,
    applyCloseAt: d.applyCloseAt,
    manualReopen: d.manualReopen,
    brandTrackerStage: d.brandTrackerStage,
    totalProductUnits: d.totalProductUnits ?? undefined,
    applicantSelectionFinalizedAt: d.applicantSelectionFinalizedAt ?? undefined,
    createdAt: d.createdAt,
    trackingNumber: d.trackingNumber ?? undefined,
  };
}

/** Editable applicant table — only while selection is open. */
function ApiApplicantTable({
  applicants,
  dropId,
  capacityTotal,
  totalProductUnits,
}: {
  applicants: BrandDropApplicant[];
  dropId: string;
  capacityTotal: number;
  totalProductUnits: number | null | undefined;
}) {
  const finalizeMutation = useFinalizeApplicants(dropId);
  const showUnits = totalProductUnits != null;
  // Explicit accept selection: finalize ACCEPTS the checked orgs and DENIES every
  // other *pending* applicant (an irreversible, email-triggering action). Without
  // explicit checkboxes an empty submit silently denied everyone (§7.1 footgun).
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);

  // After reopen, prior accepted/denied rows remain — selection only mutates applied.
  const pending = useMemo(
    () => applicants.filter((a) => a.decision === "applied"),
    [applicants],
  );
  const priorAccepted = useMemo(
    () => applicants.filter((a) => a.decision === "accepted"),
    [applicants],
  );
  const seatsTaken = priorAccepted.length;
  const unitsTaken = priorAccepted.reduce(
    (s, a) => s + (a.allocatedUnits ?? 0),
    0,
  );
  const remainingCapacity = Math.max(0, capacityTotal - seatsTaken);
  const remainingUnits =
    totalProductUnits != null
      ? Math.max(0, totalProductUnits - unitsTaken)
      : null;

  const categories = useMemo(() => {
    const present = new Set<string>();
    pending.forEach((a) => {
      if (a.category) present.add(a.category);
    });
    return Array.from(present).sort();
  }, [pending]);

  const visible =
    categoryFilter === "all"
      ? pending
      : pending.filter((a) => a.category === categoryFilter);

  // Counts span ALL pending applicants, not just the filtered view — finalize
  // denies every unaccepted pending applicant regardless of the category filter.
  const acceptedCount = pending.filter((a) => accepted[a.orgId]).length;
  const deniedCount = pending.length - acceptedCount;

  const handleFinalize = () => {
    const payload = pending
      .filter((a) => accepted[a.orgId])
      .map((a) => ({ orgId: a.orgId, units: allocations[a.orgId] ?? 0 }));
    finalizeMutation.mutate(payload, {
      onSuccess: () => setFinalizeConfirmOpen(false),
    });
  };

  const totalAllocated = pending
    .filter((a) => accepted[a.orgId])
    .reduce((s, a) => s + (allocations[a.orgId] ?? 0), 0);

  return (
    <div className={STACK.default}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={TEXT.h3}>Applicants</h2>
          <p className={cn(TEXT.meta, "mt-1")}>
            Capacity: {acceptedCount} of {remainingCapacity} remaining spots
            {seatsTaken > 0 ? ` (${seatsTaken} already accepted)` : ""}
            {showUnits && remainingUnits != null
              ? ` · ${totalAllocated} of ${remainingUnits} remaining units`
              : ""}
            {showUnits && unitsTaken > 0 ? ` (${unitsTaken} already allocated)` : ""}
          </p>
        </div>
        {categories.length > 0 ? (
          <Select
            aria-label="Filter by organization type"
            size="compact"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All types</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {orgCategoryLabel(c)}
              </option>
            ))}
          </Select>
        ) : null}
      </div>
      <Card kind="cardFlat" pad="none" className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-buzz-line bg-buzz-cream">
              <th className={cn(TEXT.micro, "px-4 py-3 text-buzz-inkMuted")}>Accept</th>
              <th className={cn(TEXT.micro, "px-4 py-3 text-buzz-inkMuted")}>Org</th>
              <th className={cn(TEXT.micro, "px-4 py-3 text-buzz-inkMuted")}>University</th>
              <th className={cn(TEXT.micro, "px-4 py-3 text-buzz-inkMuted")}>Type</th>
              <th className={cn(TEXT.micro, "px-4 py-3 text-buzz-inkMuted")}>Instagram</th>
              <th className={cn(TEXT.micro, "px-4 py-3 text-buzz-inkMuted")}>Followers</th>
              <th className={cn(TEXT.micro, "px-4 py-3 text-buzz-inkMuted")}>Pitch</th>
              {showUnits ? (
                <th className={cn(TEXT.micro, "px-4 py-3 text-buzz-inkMuted")}>Units</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={showUnits ? 8 : 7}
                  className="px-4 py-6 text-center text-sm text-buzz-inkMuted"
                >
                  No pending applicants.
                </td>
              </tr>
            ) : (
              visible.map((app) => {
                const isAccepted = !!accepted[app.orgId];
                return (
                  <tr key={app.id} className="border-b border-buzz-line">
                    <td className="px-4 py-3">
                      <Checkbox
                        aria-label={`Accept ${app.orgName}`}
                        checked={isAccepted}
                        onChange={(e) =>
                          setAccepted((prev) => ({
                            ...prev,
                            [app.orgId]: e.target.checked,
                          }))
                        }
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div>{app.orgName}</div>
                      {app.accountErased ? (
                        <div className="mt-0.5 text-xs font-medium text-buzz-inkMuted">
                          Account deleted · Shipping details removed
                        </div>
                      ) : app.deliveryAddress ? (
                        <div className="mt-0.5 text-xs font-medium text-buzz-inkMuted">
                          Ship to: {app.deliveryAddress}
                        </div>
                      ) : (
                        <div className={cn(TEXT.meta, "mt-0.5 text-buzz-warn")}>
                          Ship to: Not set — nowhere to ship product
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-buzz-inkMuted">{app.university}</td>
                    <td className="px-4 py-3 text-buzz-inkMuted">
                      {orgCategoryLabel(app.category)}
                    </td>
                    <td className="px-4 py-3 text-buzz-inkMuted">{app.instagramHandle}</td>
                    <td className="px-4 py-3">{app.followerCount ?? "-"}</td>
                    <td className="px-4 py-3 text-buzz-inkMuted max-w-48 truncate">
                      {app.pitch ?? "-"}
                    </td>
                    {showUnits ? (
                      <td className="px-4 py-3">
                        <TextField
                          type="number"
                          min={0}
                          size="compact"
                          disabled={!isAccepted}
                          className="w-16"
                          value={isAccepted ? allocations[app.orgId] ?? 0 : 0}
                          onChange={(e) =>
                            setAllocations((prev) => ({
                              ...prev,
                              [app.orgId]: Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-buzz-inkMuted">
          Accept {acceptedCount} · Deny {deniedCount}
          {showUnits ? ` · ${totalAllocated} units allocated` : ""}
        </span>
        {finalizeConfirmOpen ? (
          <Card
            kind="inset"
            pad="default"
            className={cn("w-full", STACK.tight)}
            role="region"
            aria-label="Confirm finalize"
          >
            <p className="text-sm font-medium text-buzz-ink">
              Accept {acceptedCount}{" "}
              {acceptedCount === 1 ? "org" : "orgs"} · Deny {deniedCount}{" "}
              {deniedCount === 1 ? "org" : "orgs"}. Denied applicants are
              emailed and this cannot be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="compact"
                data-testid="finalize-cancel"
                disabled={finalizeMutation.isPending}
                onClick={() => setFinalizeConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="compact"
                data-testid="finalize-confirm"
                disabled={finalizeMutation.isPending}
                onClick={handleFinalize}
              >
                {finalizeMutation.isPending
                  ? "Finalizing..."
                  : "Confirm finalize"}
              </Button>
            </div>
          </Card>
        ) : (
          <Button
            type="button"
            data-testid="finalize-selection"
            onClick={() => setFinalizeConfirmOpen(true)}
            disabled={finalizeMutation.isPending}
          >
            Finalize Selection
          </Button>
        )}
      </div>
      {finalizeMutation.isSuccess ? (
        <SuccessBanner>Selection finalized.</SuccessBanner>
      ) : null}
      {finalizeMutation.error ? (
        <ErrorBanner>
          {finalizeMutation.error instanceof Error
            ? finalizeMutation.error.message
            : "Failed to finalize."}
        </ErrorBanner>
      ) : null}
    </div>
  );
}

/** Read-only accepted roster after finalize (before live KPIs). */
function FinalizedRoster({
  applicants,
  capacityTotal,
}: {
  applicants: BrandDropApplicant[];
  capacityTotal: number;
}) {
  const accepted = applicants.filter((a) => a.decision === "accepted");
  return (
    <div className={STACK.tight}>
      <div>
        <h2 className={TEXT.h3}>Selected organizations</h2>
        <p className={cn(TEXT.meta, "mt-1")}>
          {accepted.length} of {capacityTotal} capacity · selection finalized
        </p>
      </div>
      <ApiDropOrgTable applicants={applicants} title="Accepted organizations" />
    </div>
  );
}

/** Campaign creative editor — only when admin sets brandCanEditCreative. */
function BrandCampaignEditor({ detail }: { detail: BrandDropDetail }) {
  const patch = usePatchBrandDropCreative(detail.id);
  const [title, setTitle] = useState(detail.title);
  const [description, setDescription] = useState(detail.description);
  const [image, setImage] = useState(detail.image);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const httpsPreview = (() => {
    try {
      return new URL(image.trim()).protocol === "https:";
    } catch {
      return false;
    }
  })();

  const onSave = async () => {
    setError(null);
    setNotice(null);
    const body: { title?: string; description?: string; image?: string } = {};
    if (title.trim() !== detail.title) body.title = title.trim();
    if (description.trim() !== detail.description) {
      body.description = description.trim();
    }
    if (image.trim() !== detail.image) body.image = image.trim();
    if (Object.keys(body).length === 0) {
      setNotice("No changes to save.");
      return;
    }
    try {
      await patch.mutateAsync(body);
      setNotice("Campaign updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save campaign.",
      );
    }
  };

  return (
    <Card
      data-testid="brand-campaign-editor"
      kind="card"
      pad="card"
    >
      <h2 className={TEXT.h3}>Campaign</h2>
      <p className={cn(TEXT.meta, "mt-1")}>
        Buzz can still change this.
      </p>
      <div className={cn("mt-4", STACK.tight)}>
        <TextField
          type="text"
          label="Title"
          size="compact"
          value={title}
          disabled={patch.isPending}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextArea
          label="Description"
          size="compact"
          rows={3}
          value={description}
          disabled={patch.isPending}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          type="url"
          label="Image URL"
          size="compact"
          value={image}
          disabled={patch.isPending}
          onChange={(e) => setImage(e.target.value)}
        />
        {httpsPreview ? (
          <img
            src={image.trim()}
            alt=""
            className="max-h-40 rounded-buzzControl border border-buzz-lineMid object-cover"
          />
        ) : null}
        <Button
          type="button"
          data-testid="brand-save-creative"
          disabled={patch.isPending}
          onClick={() => void onSave()}
        >
          {patch.isPending ? "Saving..." : "Save"}
        </Button>
        {notice ? <SuccessBanner>{notice}</SuccessBanner> : null}
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      </div>
    </Card>
  );
}

/** GET /api/brands/me/drops/:id. */
function ApiDropDetail() {
  const { dropId } = useParams<{ dropId: string }>();
  const { data: detail, isLoading, error } = useBrandDropDetail(dropId);

  if (isLoading) {
    return (
      <PageShell width="wide">
        <StatePanel>Loading...</StatePanel>
      </PageShell>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return <Navigate to="/brand/dashboard" replace />;
  }

  if (error || !detail) {
    return (
      <PageShell width="wide">
        <Link
          to="/brand/dashboard"
          className="mb-6 flex items-center text-sm font-semibold text-buzz-inkMuted transition hover:text-buzz-coral"
        >
          <ChevronLeft size={16} className="mr-1" />
          Back to dashboard
        </Link>
        <StatePanel tone="danger">
          {error instanceof Error
            ? error.message
            : "Couldn’t load this drop. Please try again."}
        </StatePanel>
      </PageShell>
    );
  }

  const drop = mapDropToView(detail);
  const showResults =
    drop.brandTrackerStage === "drop_active" ||
    drop.brandTrackerStage === "drop_finished";
  const canEditSelection =
    drop.applicantSelectionFinalizedAt == null &&
    (drop.brandTrackerStage === "finalizing_agreements" ||
      (drop.brandTrackerStage === "request_received" &&
        !drop.manualReopen &&
        Date.now() > drop.applyCloseAt));
  const showFinalizedRoster =
    drop.applicantSelectionFinalizedAt != null &&
    (drop.brandTrackerStage === "finalizing_agreements" ||
      drop.brandTrackerStage === "awaiting_products");
  const showAwaitingRoster = drop.brandTrackerStage === "awaiting_products";

  const aggregateMetrics = {
    dropId: detail.id,
    totalPosts: detail.totalPosts ?? 0,
    totalLikes: detail.totalLikes ?? 0,
    totalComments: detail.totalComments ?? 0,
    totalEngagement: detail.totalEngagement ?? 0,
    totalReach: detail.totalReach ?? 0,
    costPerEngagement: null as number | null,
  };

  return (
    <PageShell width="wide">
      <Link
        to="/brand/dashboard"
        className="mb-6 flex items-center text-sm font-semibold text-buzz-inkMuted transition hover:text-buzz-coral"
      >
        <ChevronLeft size={16} className="mr-1" />
        Back to dashboard
      </Link>

      <header className="mb-8">
        <h1 className={TEXT.h1}>{detail.title}</h1>
        <p className={cn(TEXT.body, "mt-2 text-buzz-inkMuted")}>
          {detail.description}
        </p>
      </header>

      <div className={STACK.section}>
        <BrandDropTrackerStepper
          currentStage={drop.brandTrackerStage as any}
          trackingNumber={drop.trackingNumber}
        />

        {detail.brandCanEditCreative ? (
          <BrandCampaignEditor detail={detail} />
        ) : null}

        {canEditSelection ? (
          <ApiApplicantTable
            applicants={detail.applications ?? []}
            dropId={detail.id}
            capacityTotal={detail.capacityTotal}
            totalProductUnits={detail.totalProductUnits}
          />
        ) : null}

        {showFinalizedRoster && !showResults ? (
          <FinalizedRoster
            applicants={detail.applications ?? []}
            capacityTotal={detail.capacityTotal}
          />
        ) : null}

        {showAwaitingRoster && !showFinalizedRoster && !showResults ? (
          <ApiDropOrgTable
            applicants={detail.applications ?? []}
            title="Accepted organizations"
          />
        ) : null}

        {showResults ? (
          <div className={STACK.group}>
            <DropKPISummary metrics={aggregateMetrics} />
            <ApiDropOrgTable applicants={detail.applications ?? []} />
          </div>
        ) : !canEditSelection && !showFinalizedRoster && !showAwaitingRoster ? (
          <StatePanel>
            Posts and KPIs will appear here once your drop goes live.
          </StatePanel>
        ) : null}
      </div>
    </PageShell>
  );
}

export default function BrandDropDetailPage() {
  return <ApiDropDetail />;
}
