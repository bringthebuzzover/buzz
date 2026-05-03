/**
 * `/brand/drops/:dropId` — per-drop detail. Always renders the read-only tracker.
 * Posts table + KPIs are only visible when the drop is `active_campaign` or
 * `completed` (PRODUCT.md §5.3.1 — brand cannot see post data before the drop
 * is live).
 *
 * The brand persona may only land here for drops that the demo brand owns.
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
import DropKPISummary from "../../components/brand/DropKPISummary";
import { computeDropAggregate } from "../../utils/metrics";
import { DEMO_BRAND_ID } from "../../data/seed/seedBrands";
import { SEED_ORGS } from "../../data/seed/seedOrgs";

export default function BrandDropDetailPage() {
  const { dropId } = useParams<{ dropId: string }>();
  const drop = useDrop(dropId);
  const applications = useApplications();
  const posts = usePosts();
  const links = useLinks();

  if (!drop || drop.brandId !== DEMO_BRAND_ID) {
    return <Navigate to="/brand/dashboard" replace />;
  }

  const showResults =
    drop.brandTrackerStage === "active_campaign" ||
    drop.brandTrackerStage === "completed";

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
        currentStage={drop.brandTrackerStage}
        trackingNumber={drop.trackingNumber}
      />

      {drop.brandTrackerStage === "applicant_selection" ? (
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
