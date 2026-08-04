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
import { useBrandDropDetail, useFinalizeApplicants } from "../../api/hooks/useBrandHooks";
import type { BrandDropDetail, BrandDropApplicant } from "../../api/hooks/useBrandHooks";
import { ApiError } from "../../api/errors";
import { useMemo, useState } from "react";
import { orgCategoryLabel } from "../../types/orgCategory";

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
    const ok = window.confirm(
      `Finalize this drop?\n\n` +
        `Accept ${acceptedCount} ${acceptedCount === 1 ? "org" : "orgs"} · ` +
        `Deny ${deniedCount} ${deniedCount === 1 ? "org" : "orgs"}.\n\n` +
        `Denied applicants are emailed and this cannot be undone.`,
    );
    if (ok) finalizeMutation.mutate(payload);
  };

  const totalAllocated = pending
    .filter((a) => accepted[a.orgId])
    .reduce((s, a) => s + (allocations[a.orgId] ?? 0), 0);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-buzz-ink">Applicants</h2>
          <p className="mt-1 text-xs font-medium text-buzz-inkMuted">
            Capacity: {acceptedCount} of {remainingCapacity} remaining spots
            {seatsTaken > 0 ? ` (${seatsTaken} already accepted)` : ""}
            {showUnits && remainingUnits != null
              ? ` · ${totalAllocated} of ${remainingUnits} remaining units`
              : ""}
            {showUnits && unitsTaken > 0 ? ` (${unitsTaken} already allocated)` : ""}
          </p>
        </div>
        {categories.length > 0 ? (
          <select
            aria-label="Filter by organization type"
            className="rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-1.5 text-xs font-semibold text-buzz-ink"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All types</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {orgCategoryLabel(c)}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-buzz-lineMid bg-buzz-paper">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-buzz-line bg-buzz-cream">
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Accept</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Org</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">University</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Type</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Instagram</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Followers</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Pitch</th>
              {showUnits ? (
                <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Units</th>
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
                      <input
                        type="checkbox"
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
                    <td className="px-4 py-3 font-medium">{app.orgName}</td>
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
                        <input
                          type="number"
                          min={0}
                          disabled={!isAccepted}
                          className="w-16 rounded border border-buzz-lineMid px-2 py-1 text-sm disabled:bg-buzz-cream disabled:opacity-50"
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
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-buzz-inkMuted">
          Accept {acceptedCount} · Deny {deniedCount}
          {showUnits ? ` · ${totalAllocated} units allocated` : ""}
        </span>
        <button
          type="button"
          onClick={handleFinalize}
          disabled={finalizeMutation.isPending}
          className="rounded-xl bg-buzz-coral px-6 py-2 text-sm font-bold text-buzz-paper hover:bg-buzz-coralDark disabled:opacity-60"
        >
          {finalizeMutation.isPending ? "Finalizing..." : "Finalize Selection"}
        </button>
      </div>
      {finalizeMutation.isSuccess ? (
        <p className="text-sm font-medium text-green-600">Selection finalized.</p>
      ) : null}
      {finalizeMutation.error ? (
        <p className="text-sm font-medium text-buzz-coral">
          {finalizeMutation.error instanceof Error
            ? finalizeMutation.error.message
            : "Failed to finalize."}
        </p>
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
    <div className="mt-8 space-y-3">
      <div>
        <h2 className="text-lg font-bold text-buzz-ink">Selected organizations</h2>
        <p className="mt-1 text-xs font-medium text-buzz-inkMuted">
          {accepted.length} of {capacityTotal} capacity · selection finalized
        </p>
      </div>
      <ApiDropOrgTable applicants={applicants} title="Accepted organizations" />
    </div>
  );
}

/** GET /api/brands/me/drops/:id. */
function ApiDropDetail() {
  const { dropId } = useParams<{ dropId: string }>();
  const { data: detail, isLoading, error } = useBrandDropDetail(dropId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-12 text-center">
        <p className="text-sm font-medium text-buzz-inkMuted">Loading...</p>
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return <Navigate to="/brand/dashboard" replace />;
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-12">
        <Link
          to="/brand/dashboard"
          className="mb-6 flex items-center text-sm font-bold text-buzz-inkMuted transition hover:text-buzz-coral"
        >
          <ChevronLeft size={16} className="mr-1" />
          Back to dashboard
        </Link>
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-8 text-center text-sm font-medium text-buzz-coral">
          {error instanceof Error
            ? error.message
            : "Couldn’t load this drop. Please try again."}
        </div>
      </div>
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
    <div className="mx-auto max-w-5xl px-8 py-12">
      <Link
        to="/brand/dashboard"
        className="mb-6 flex items-center text-sm font-bold text-buzz-inkMuted transition hover:text-buzz-coral"
      >
        <ChevronLeft size={16} className="mr-1" />
        Back to dashboard
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-buzz-ink">{detail.title}</h1>
        <p className="mt-2 text-sm font-medium text-buzz-inkMuted">
          {detail.description}
        </p>
      </header>

      <BrandDropTrackerStepper
        currentStage={drop.brandTrackerStage as any}
        trackingNumber={drop.trackingNumber}
      />

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
        <div className="mt-8">
          <ApiDropOrgTable
            applicants={detail.applications ?? []}
            title="Accepted organizations"
          />
        </div>
      ) : null}

      {showResults ? (
        <div className="mt-8 space-y-6">
          <DropKPISummary metrics={aggregateMetrics} />
          <ApiDropOrgTable applicants={detail.applications ?? []} />
        </div>
      ) : !canEditSelection && !showFinalizedRoster && !showAwaitingRoster ? (
        <div className="mt-8 rounded-2xl border border-dashed border-buzz-lineMid bg-buzz-cream p-8 text-center text-sm font-medium text-buzz-inkMuted">
          Posts and KPIs will appear here once your drop goes live.
        </div>
      ) : null}
    </div>
  );
}

export default function BrandDropDetailPage() {
  return <ApiDropDetail />;
}
