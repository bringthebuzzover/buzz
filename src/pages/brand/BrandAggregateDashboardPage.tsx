/**
 * `/brand/dashboard` — Brand Aggregate Dashboard (PRODUCT.md §5.3.2).
 *
 * Renders from the real backend (GET /api/brands/me/aggregate,
 * /api/brands/me/drops, /api/brands/me/engagement-series).
 */
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import AggregateTotalsCards from "../../components/brand/AggregateTotalsCards";
import ApiCompareDropsTable from "../../components/brand/ApiCompareDropsTable";
import EngagementOverTimeChart from "../../components/brand/EngagementOverTimeChart";
import RunningTotalsBar from "../../components/brand/RunningTotalsBar";
import PlanCampaignModal from "../../components/site/modals/PlanCampaignModal";
import {
  useBrandAggregate,
  useBrandDrops,
  useEngagementSeries,
} from "../../api/hooks/useBrandHooks";
import type { BrandAggregate, EngagementPoint } from "../../api/hooks/useBrandHooks";

type DashboardLocationState = { openPlanCampaign?: boolean };

const PAGE_SHELL = "mx-auto max-w-6xl px-8 py-12";

function DashboardHeader({
  onPlanCampaign,
}: {
  onPlanCampaign: () => void;
}) {
  return (
    <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 className="text-3xl font-bold text-buzz-ink">Brand Dashboard</h1>
        <p className="mt-1 text-sm font-medium text-buzz-inkMuted">
          Aggregate performance across every drop you've run with Buzz.
        </p>
      </div>
      <button
        type="button"
        onClick={onPlanCampaign}
        className="flex items-center gap-2 rounded-lg bg-buzz-coral px-4 py-2 font-bold text-buzz-paper shadow-sm transition hover:bg-buzz-coralDark"
      >
        <Sparkles size={16} /> Plan your Campaign
      </button>
    </header>
  );
}

/** Map backend aggregate shape to what components expect. */
function mapAggregate(a: BrandAggregate) {
  return {
    brandId: "",
    totalDrops: a.totalDrops,
    totalPosts: a.totalPosts,
    totalLikes: a.totalLikes,
    totalComments: a.totalComments,
    totalEngagement: a.totalEngagement,
    totalReach: a.totalReach,
    totalOrgs: a.totalOrgs,
    totalCampuses: a.totalCampuses,
  };
}

function mapEngagementSeries(points: EngagementPoint[]) {
  return points.map((p) => ({
    timestamp: p.timestamp,
    engagement: p.engagement,
  }));
}

function ApiDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [planCampaignOpen, setPlanCampaignOpen] = useState(false);
  const { data: aggregate, isLoading: aggLoading, isError: aggError } = useBrandAggregate();
  const { data: drops, isLoading: dropsLoading, isError: dropsError } = useBrandDrops();
  const { data: series, isLoading: seriesLoading, isError: seriesError } =
    useEngagementSeries();

  useEffect(() => {
    const st = location.state as DashboardLocationState | null;
    if (st?.openPlanCampaign) {
      setPlanCampaignOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const isLoading = aggLoading || dropsLoading || seriesLoading;
  const isError = aggError || dropsError || seriesError;

  if (isLoading) {
    return (
      <div className={PAGE_SHELL}>
        <DashboardHeader onPlanCampaign={() => {}} />
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-inkMuted">
          Loading dashboard…
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={PAGE_SHELL}>
        <DashboardHeader onPlanCampaign={() => {}} />
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-coral">
          Couldn’t load your dashboard. Please try again.
        </div>
      </div>
    );
  }

  const items = drops ?? [];
  const agg = aggregate ?? {
    totalDrops: 0, totalPosts: 0, totalLikes: 0, totalComments: 0,
    totalEngagement: 0, totalReach: 0, totalOrgs: 0, totalCampuses: 0,
  };
  const pts = series ?? [];

  return (
    <div className={PAGE_SHELL}>
      <DashboardHeader onPlanCampaign={() => setPlanCampaignOpen(true)} />
      {items.length === 0 ? (
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center">
          <p className="text-sm font-medium text-buzz-inkMuted">
            No drops yet. Use Plan your Campaign to connect with a Buzz
            consultant about your activation.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <RunningTotalsBar metrics={mapAggregate(agg)} />
          <AggregateTotalsCards metrics={mapAggregate(agg)} />
          <EngagementOverTimeChart points={mapEngagementSeries(pts)} />
          <ApiCompareDropsTable drops={items} />
        </div>
      )}
      {planCampaignOpen ? (
        <PlanCampaignModal onClose={() => setPlanCampaignOpen(false)} />
      ) : null}
    </div>
  );
}

export default function BrandAggregateDashboardPage() {
  return <ApiDashboard />;
}
