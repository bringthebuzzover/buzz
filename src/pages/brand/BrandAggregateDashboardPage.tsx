/**
 * `/brand/dashboard` — Brand Aggregate Dashboard (PRODUCT.md §5.3.2). Composes
 * the running totals bar, totals cards, engagement-over-time chart, and the
 * sortable drop comparison table. Empty state when the brand has no drops.
 */
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  useApplications,
  useBrandDrops,
  useLinks,
  usePosts,
} from "../../contexts/MockDataContext";
import { useDemoNow } from "../../contexts/DemoClockContext";
import {
  computeBrandAggregate,
  computeEngagementTimeSeries,
} from "../../utils/metrics";
import { DEMO_BRAND_ID } from "../../data/seed/seedBrands";
import { SEED_ORGS } from "../../data/seed/seedOrgs";
import AggregateTotalsCards from "../../components/brand/AggregateTotalsCards";
import CompareDropsTable from "../../components/brand/CompareDropsTable";
import EngagementOverTimeChart from "../../components/brand/EngagementOverTimeChart";
import RunningTotalsBar from "../../components/brand/RunningTotalsBar";
import PlanCampaignModal from "../../components/site/modals/PlanCampaignModal";

type DashboardLocationState = { openPlanCampaign?: boolean };

export default function BrandAggregateDashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [planCampaignOpen, setPlanCampaignOpen] = useState(false);
  const drops = useBrandDrops(DEMO_BRAND_ID);
  const applications = useApplications();
  const links = useLinks();
  const posts = usePosts();
  const now = useDemoNow();

  useEffect(() => {
    const st = location.state as DashboardLocationState | null;
    if (st?.openPlanCampaign) {
      setPlanCampaignOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const aggregate = computeBrandAggregate({
    brandId: DEMO_BRAND_ID,
    drops,
    applications,
    links,
    posts,
    orgs: SEED_ORGS,
  });

  const series = computeEngagementTimeSeries({
    brandId: DEMO_BRAND_ID,
    drops,
    links,
    posts,
    now,
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-buzz-ink">Brand Dashboard</h1>
          <p className="mt-1 text-sm font-medium text-buzz-inkMuted">
            Aggregate performance across every drop you've run with Buzz.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPlanCampaignOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-buzz-coral px-4 py-2 font-bold text-buzz-paper shadow-sm transition hover:bg-buzz-coralDark"
        >
          <Sparkles size={16} /> Plan your Campaign
        </button>
      </header>

      {drops.length === 0 ? (
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center">
          <p className="text-sm font-medium text-buzz-inkMuted">
            No drops yet. Use Plan your Campaign to connect with a Buzz
            consultant about your activation.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <RunningTotalsBar metrics={aggregate} />
          <AggregateTotalsCards metrics={aggregate} />
          <EngagementOverTimeChart points={series} />
          <CompareDropsTable
            drops={drops}
            applications={applications}
            links={links}
            posts={posts}
            orgs={SEED_ORGS}
          />
        </div>
      )}
      {planCampaignOpen ? (
        <PlanCampaignModal onClose={() => setPlanCampaignOpen(false)} />
      ) : null}
    </div>
  );
}
