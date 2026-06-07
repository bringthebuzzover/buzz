/**
 * `/brand/drops/:dropId` — per-drop detail.
 *
 * Stage 6 (strangler): behind USE_API this page renders from the real backend
 * (GET /api/brands/me/drops/:id). With the flag off it keeps the original demo behavior.
 */
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import {
  useApplications,
  useDrop,
  useLinks,
  usePosts,
} from "../../contexts/MockDataContext";
import BrandDropTrackerStepper from "../../components/brand/BrandDropTrackerStepper";
import BrandApplicantSelection from "../../components/brand/BrandApplicantSelection";
import PerDropPostsTable from "../../components/brand/PerDropPostsTable";
import ApiDropOrgTable from "../../components/brand/ApiDropOrgTable";
import DropKPISummary from "../../components/brand/DropKPISummary";
import { computeDropAggregate } from "../../utils/metrics";
import { DEMO_BRAND_ID } from "../../data/seed/seedBrands";
import { SEED_ORGS } from "../../data/seed/seedOrgs";
import { USE_API } from "../../config/featureFlags";
import { useBrandDropDetail, useFinalizeApplicants } from "../../api/hooks/useBrandHooks";
import type { BrandDropDetail, BrandDropApplicant } from "../../api/hooks/useBrandHooks";
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

/** Demo path: localStorage stores. */
function DemoDropDetail() {
  const { dropId } = useParams<{ dropId: string }>();
  const drop = useDrop(dropId);
  const applications = useApplications();
  const posts = usePosts();
  const links = useLinks();

  if (!drop || drop.brandId !== DEMO_BRAND_ID) {
    return <Navigate to="/brand/dashboard" replace />;
  }

  const showResults =
    drop.brandTrackerStage === "drop_active" ||
    drop.brandTrackerStage === "drop_finished";

  const metrics = computeDropAggregate({
    drop,
    applications,
    links,
    posts,
    orgs: SEED_ORGS,
  });

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
        <h1 className="text-3xl font-bold text-buzz-ink">{drop.title}</h1>
        <p className="mt-2 text-sm font-medium text-buzz-inkMuted">
          {drop.description}
        </p>
      </header>

      <BrandDropTrackerStepper
        currentStage={drop.brandTrackerStage as any}
        trackingNumber={drop.trackingNumber}
      />

      {drop.brandTrackerStage === "finalizing_agreements" ? (
        <BrandApplicantSelection
          drop={drop}
          applications={applications}
          orgs={SEED_ORGS}
          links={links}
          posts={posts}
        />
      ) : null}

      {showResults ? (
        <div className="mt-8 space-y-6">
          <DropKPISummary metrics={metrics} />
          <PerDropPostsTable dropId={drop.id} />
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-buzz-lineMid bg-buzz-cream p-8 text-center text-sm font-medium text-buzz-inkMuted">
          Posts and KPIs will appear here once your drop goes live.
        </div>
      )}
    </div>
  );
}

/** Simple applicant table for the API path at finalizing_agreements stage. */
function ApiApplicantTable({
  applicants,
  dropId,
}: {
  applicants: BrandDropApplicant[];
  dropId: string;
}) {
  const finalizeMutation = useFinalizeApplicants(dropId);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const present = new Set<string>();
    applicants.forEach((a) => {
      if (a.category) present.add(a.category);
    });
    return Array.from(present).sort();
  }, [applicants]);

  const visible =
    categoryFilter === "all"
      ? applicants
      : applicants.filter((a) => a.category === categoryFilter);

  const handleFinalize = () => {
    const payload = Object.entries(allocations).map(([orgId, units]) => ({
      orgId,
      units,
    }));
    finalizeMutation.mutate(payload);
  };

  const totalAllocated = Object.values(allocations).reduce((s, u) => s + u, 0);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-buzz-ink">Applicants</h2>
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
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Org</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">University</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Type</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Instagram</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Followers</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Pitch</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-buzz-inkMuted">Units</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((app) => (
              <tr key={app.id} className="border-b border-buzz-line">
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
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    className="w-16 rounded border border-buzz-lineMid px-2 py-1 text-sm"
                    value={allocations[app.orgId] ?? 0}
                    onChange={(e) =>
                      setAllocations((prev) => ({
                        ...prev,
                        [app.orgId]: Math.max(0, parseInt(e.target.value, 10) || 0),
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-buzz-inkMuted">
          Total allocated: {totalAllocated} units
        </span>
        <button
          type="button"
          onClick={handleFinalize}
          disabled={finalizeMutation.isPending}
          className="rounded-xl bg-buzz-coral px-6 py-2 text-sm font-bold text-buzz-paper hover:bg-buzz-coralDark disabled:opacity-60"
        >
          {finalizeMutation.isPending ? "Finalizing..." : "Finalize Allocations"}
        </button>
      </div>
      {finalizeMutation.isSuccess ? (
        <p className="text-sm font-medium text-green-600">Allocations finalized.</p>
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

/** API path: GET /api/brands/me/drops/:id. */
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

  if (error || !detail) {
    return <Navigate to="/brand/dashboard" replace />;
  }

  const drop = mapDropToView(detail);
  const showResults =
    drop.brandTrackerStage === "drop_active" ||
    drop.brandTrackerStage === "drop_finished";
  const isSelectionStage = drop.brandTrackerStage === "finalizing_agreements";

  const aggregateMetrics = {
    dropId: detail.id,
    totalPosts: detail.totalPosts,
    totalLikes: detail.totalLikes,
    totalComments: detail.totalComments,
    totalEngagement: detail.totalEngagement,
    totalReach: detail.totalReach,
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

      {isSelectionStage ? (
        <ApiApplicantTable
          applicants={detail.applications ?? []}
          dropId={detail.id}
        />
      ) : null}

      {showResults ? (
        <div className="mt-8 space-y-6">
          <DropKPISummary metrics={aggregateMetrics} />
          <ApiDropOrgTable applicants={detail.applications ?? []} />
        </div>
      ) : !isSelectionStage ? (
        <div className="mt-8 rounded-2xl border border-dashed border-buzz-lineMid bg-buzz-cream p-8 text-center text-sm font-medium text-buzz-inkMuted">
          Posts and KPIs will appear here once your drop goes live.
        </div>
      ) : null}
    </div>
  );
}

export default function BrandDropDetailPage() {
  return USE_API ? <ApiDropDetail /> : <DemoDropDetail />;
}
