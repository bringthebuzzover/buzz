/**
 * `/brand/drops/:dropId` — per-drop detail.
 *
 * Renders from the real backend (GET /api/brands/me/drops/:id).
 */
import { Navigate, useParams } from "react-router-dom";
import BrandDropTrackerStepper from "../../components/brand/BrandDropTrackerStepper";
import ApiDropOrgTable from "../../components/brand/ApiDropOrgTable";
import DropKPISummary from "../../components/brand/DropKPISummary";
import DropStageBadge from "../../components/brand/DropStageBadge";
import {
  useBrandDropDetail,
  useFinalizeApplicants,
  usePatchBrandDropCreative,
} from "../../api/hooks/useBrandHooks";
import type { BrandDropDetail, BrandDropApplicant } from "../../api/hooks/useBrandHooks";
import { ApiError } from "../../api/errors";
import { useMemo, useState } from "react";
import { orgCategoryLabel } from "../../types/orgCategory";
import type { BrandDropTrackerStage } from "../../types/brandPortal";
import PageShell from "../../components/site/PageShell";
import { Card, CardHeader } from "../../components/ui/Card";
import { EmptyState, Loader } from "../../components/ui/EmptyState";
import { BackLink, PageHeader } from "../../components/ui/PageHeader";
import { StatePanel } from "../../components/ui/StatePanel";
import { Table, TBody, THead, Td, Th, Tr } from "../../components/ui/Table";
import { Toggle } from "../../components/ui/Toggle";
import {
  Button,
  ErrorBanner,
  Select,
  SuccessBanner,
  TextArea,
  TextField,
} from "../../components/forms/controls";
import { STACK, SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import { useMdUp } from "../../hooks/useMdUp";
import CopyPublicDropUrl from "../../components/drop/CopyPublicDropUrl";

const backLink = <BackLink to="/brand/dashboard">Back to dashboard</BackLink>;

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
  const mdUp = useMdUp();
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
    () => applicants.filter((a) => a.decision === "applied" && !a.accountErased),
    [applicants],
  );
  const priorAccepted = useMemo(
    () => applicants.filter((a) => a.decision === "accepted"),
    [applicants],
  );
  const seatsTaken = priorAccepted.length;
  const unitsTaken = priorAccepted.reduce((s, a) => s + (a.allocatedUnits ?? 0), 0);
  const remainingCapacity = Math.max(0, capacityTotal - seatsTaken);
  const remainingUnits =
    totalProductUnits != null ? Math.max(0, totalProductUnits - unitsTaken) : null;

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

  const toggleAccept = (app: BrandDropApplicant) => (
    <Toggle
      aria-label={`Accept ${app.orgName}`}
      checked={!!accepted[app.orgId]}
      onChange={(next) => setAccepted((prev) => ({ ...prev, [app.orgId]: next }))}
    />
  );

  const unitsField = (
    app: BrandDropApplicant,
    props: { label?: string; className: string },
  ) => {
    const isAccepted = !!accepted[app.orgId];
    return (
      <TextField
        id={`units-${app.orgId}`}
        type="number"
        min={0}
        size="compact"
        disabled={!isAccepted}
        value={isAccepted ? (allocations[app.orgId] ?? 0) : 0}
        onChange={(e) =>
          setAllocations((prev) => ({
            ...prev,
            [app.orgId]: Math.max(0, parseInt(e.target.value, 10) || 0),
          }))
        }
        {...props}
      />
    );
  };

  // Quiet paper falls just under AA on the yellow wash, so a selected row uses muted.
  const subtle = (app: BrandDropApplicant) =>
    accepted[app.orgId] ? "text-muted" : "text-quiet";

  const shipToLine = (app: BrandDropApplicant) =>
    app.accountErased ? null : (
      <p className={cn("mt-1 text-xs", subtle(app))}>
        Ship to: {app.deliveryAddress || "Address pending"}
      </p>
    );

  return (
    <Card kind="panel" pad="card" className="flex flex-col gap-5">
      <CardHeader
        title="Applicants"
        description={
          <>
            Capacity: {acceptedCount} of {remainingCapacity} remaining spots
            {seatsTaken > 0 ? ` (${seatsTaken} already accepted)` : ""}
            {showUnits && remainingUnits != null
              ? ` · ${totalAllocated} of ${remainingUnits} remaining units`
              : ""}
            {showUnits && unitsTaken > 0 ? ` (${unitsTaken} already allocated)` : ""}
          </>
        }
        actions={
          categories.length > 0 ? (
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
          ) : null
        }
        className="mb-0"
      />
      {visible.length === 0 ? (
        <EmptyState>No pending applicants.</EmptyState>
      ) : !mdUp ? (
        <ul className="flex flex-col gap-3">
          {visible.map((app) => (
            <li
              key={app.id}
              className={cn(
                SURFACE.inset,
                "flex items-start gap-3 p-4",
                accepted[app.orgId] && "bg-accent-wash",
              )}
            >
              {toggleAccept(app)}
              <div className="min-w-0 flex-1">
                <p className={cn(TEXT.body, "font-medium text-primary")}>{app.orgName}</p>
                <p className={cn(TEXT.body, subtle(app))}>
                  {app.university}
                  {app.category ? ` · ${orgCategoryLabel(app.category)}` : ""}
                  {` · ${app.followerCount ?? "-"} followers`}
                </p>
                <p className={cn(TEXT.body, "mt-1", subtle(app))}>
                  {app.instagramHandle}
                </p>
                <p className={cn(TEXT.body, "mt-2 text-primary")}>{app.pitch ?? "—"}</p>
                {shipToLine(app)}
                {showUnits
                  ? unitsField(app, { label: "Units", className: "mt-2 w-24" })
                  : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Table>
          <THead>
            <tr>
              <Th className="w-20">Accept</Th>
              <Th>Organization</Th>
              <Th className="w-48">University</Th>
              <Th className="w-28">Type</Th>
              <Th className="w-32">Instagram</Th>
              <Th className="w-24 text-right">Followers</Th>
              <Th className="w-48">Pitch</Th>
              {showUnits ? <Th className="w-24">Units</Th> : null}
            </tr>
          </THead>
          <TBody>
            {visible.map((app) => (
              <Tr key={app.id} className={cn(accepted[app.orgId] && "bg-accent-wash")}>
                <Td>{toggleAccept(app)}</Td>
                <Td>
                  <div className="text-primary">{app.orgName}</div>
                  {shipToLine(app)}
                </Td>
                <Td muted>{app.university}</Td>
                <Td muted>{orgCategoryLabel(app.category)}</Td>
                <Td muted>{app.instagramHandle}</Td>
                <Td className="text-right tabular-nums">{app.followerCount ?? "-"}</Td>
                <Td muted className="max-w-48 truncate">
                  {app.pitch ?? "-"}
                </Td>
                {showUnits ? <Td>{unitsField(app, { className: "w-16" })}</Td> : null}
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <span className={cn(TEXT.body, "text-muted")}>
          Accept {acceptedCount} · Deny {deniedCount}
          {showUnits ? ` · ${totalAllocated} units allocated` : ""}
        </span>
        {finalizeConfirmOpen ? null : (
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
      {finalizeConfirmOpen ? (
        <div
          className={cn(SURFACE.inset, "flex flex-col gap-3 p-4")}
          role="region"
          aria-label="Confirm finalize"
        >
          <p className={cn(TEXT.body, "text-primary")}>
            Accept {acceptedCount}{" "}
            {acceptedCount === 1 ? "organization" : "organizations"} · Deny {deniedCount}{" "}
            {deniedCount === 1 ? "organization" : "organizations"}. Denied applicants are
            emailed and this cannot be undone.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              data-testid="finalize-cancel"
              disabled={finalizeMutation.isPending}
              onClick={() => setFinalizeConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="finalize-confirm"
              disabled={finalizeMutation.isPending}
              onClick={handleFinalize}
            >
              {finalizeMutation.isPending ? "Finalizing..." : "Confirm finalize"}
            </Button>
          </div>
        </div>
      ) : null}
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
    </Card>
  );
}

/** Read-only accepted roster after finalize (before live KPIs). */
function FinalizedRoster({ applicants }: { applicants: BrandDropApplicant[] }) {
  return <ApiDropOrgTable applicants={applicants} title="Selected organizations" />;
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
      setError(err instanceof Error ? err.message : "Could not save campaign.");
    }
  };

  return (
    <Card data-testid="brand-campaign-editor" kind="panel" pad="card">
      <CardHeader
        title="Campaign"
        description="BUZZ can still change this."
        className="mb-5"
      />
      <div className={STACK.default}>
        <TextField
          type="text"
          label="Title"
          value={title}
          disabled={patch.isPending}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextArea
          label="Description"
          rows={3}
          value={description}
          disabled={patch.isPending}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          type="url"
          label="Image URL"
          value={image}
          disabled={patch.isPending}
          onChange={(e) => setImage(e.target.value)}
        />
        {httpsPreview ? (
          <img
            src={image.trim()}
            alt=""
            className="max-h-40 rounded-buzzCard border border-line object-cover"
          />
        ) : null}
        <div className="flex justify-end">
          <Button
            type="button"
            data-testid="brand-save-creative"
            disabled={patch.isPending}
            onClick={() => void onSave()}
          >
            {patch.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
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
        <Loader label="Loading drop…" />
      </PageShell>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return <Navigate to="/brand/dashboard" replace />;
  }

  if (error || !detail) {
    return (
      <PageShell width="wide" className={STACK.group}>
        {backLink}
        <StatePanel tone="danger">
          {error instanceof Error
            ? error.message
            : "Couldn’t load this drop. Please try again."}
        </StatePanel>
      </PageShell>
    );
  }

  const stage = detail.brandTrackerStage;
  const showResults =
    stage === "awaiting_products" || stage === "drop_active" || stage === "drop_finished";
  const canEditSelection =
    detail.applicantSelectionFinalizedAt == null &&
    (stage === "finalizing_agreements" ||
      (stage === "request_received" &&
        !detail.manualReopen &&
        Date.now() > detail.applyCloseAt));
  const showFinalizedRoster =
    detail.applicantSelectionFinalizedAt != null &&
    stage === "finalizing_agreements";

  const aggregateMetrics = {
    dropId: detail.id,
    totalPosts: detail.totalPosts ?? 0,
    totalLikes: detail.totalLikes ?? 0,
    totalComments: detail.totalComments ?? 0,
    totalEngagement: detail.totalEngagement ?? 0,
    totalReach: detail.totalReach ?? 0,
  };

  return (
    <PageShell width="wide" className={STACK.section}>
      <div className="flex flex-col gap-5">
        <PageHeader
          back={backLink}
          title={detail.title}
          description={detail.description}
          actions={<DropStageBadge stage={stage} />}
          className="mb-0"
        />
        {detail.publishedAt != null ? <CopyPublicDropUrl dropId={detail.id} /> : null}
      </div>

      <BrandDropTrackerStepper currentStage={stage as BrandDropTrackerStage} />

      {detail.brandCanEditCreative ? <BrandCampaignEditor detail={detail} /> : null}

      {canEditSelection ? (
        <ApiApplicantTable
          applicants={detail.applications ?? []}
          dropId={detail.id}
          capacityTotal={detail.capacityTotal}
          totalProductUnits={detail.totalProductUnits}
        />
      ) : null}

      {showFinalizedRoster && !showResults ? (
        <FinalizedRoster applicants={detail.applications ?? []} />
      ) : null}

      {showResults ? (
        <>
          <DropKPISummary metrics={aggregateMetrics} />
          <ApiDropOrgTable applicants={detail.applications ?? []} />
        </>
      ) : !canEditSelection && !showFinalizedRoster ? (
        <StatePanel>Posts and KPIs will appear here once your drop goes live.</StatePanel>
      ) : null}
    </PageShell>
  );
}

export default function BrandDropDetailPage() {
  return <ApiDropDetail />;
}
