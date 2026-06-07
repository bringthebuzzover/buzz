/**
 * `/org/campaigns/:campaignId` — per-status detail view.
 *
 * Stage 6 (strangler): behind USE_API this page renders from the real backend
 * (GET /api/campaigns/:id + derived status). With the flag off it keeps
 * the original demo behavior.
 */
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronLeft, ClipboardList, Truck } from "lucide-react";
import {
  useApplications,
  useDrops,
} from "../../contexts/MockDataContext";
import { deriveOrgCampaignStatus } from "../../utils/orgCampaignStatus";
import { ORG_CAMPAIGN_STATUS_LABELS } from "../../types/orgCampaign";
import PostSelector from "../../components/org/PostSelector";
import ApiPostSelector from "../../components/org/ApiPostSelector";
import AggregateScoreCard from "../../components/org/AggregateScoreCard";
import { DEMO_ORG_ID } from "../../data/seed/seedOrgs";
import { USE_API } from "../../config/featureFlags";
import { useCampaignDetail, useCampaignAggregate } from "../../api/hooks/useOrgHooks";

function StatusPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-buzz-lineMid bg-buzz-paper p-8 shadow-sm">
      {children}
    </div>
  );
}

/** Map backend tracker stage + decision → org-campaign status. */
function apiDeriveStatus(detail: {
  decision: string;
  brandTrackerStage: string;
}) {
  if (detail.decision === "denied") return null;
  if (detail.decision === "applied") return "applied" as const;
  if (detail.decision === "accepted") {
    const stage = detail.brandTrackerStage;
    if (stage === "drop_active") return "active" as const;
    if (stage === "drop_finished") return "finished" as const;
    return "accepted" as const;
  }
  return null;
}

/** Demo path: localStorage stores. */
function DemoCampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const applications = useApplications();
  const drops = useDrops();

  const application = applications.find((a) => a.id === campaignId);
  if (!application || application.orgId !== DEMO_ORG_ID) {
    return <Navigate to="/org/campaigns" replace />;
  }

  const drop = drops.find((d) => d.id === application.dropId);
  if (!drop) {
    return <Navigate to="/org/campaigns" replace />;
  }

  const status = deriveOrgCampaignStatus(application, drop);
  if (status == null) {
    return <Navigate to="/org/campaigns" replace />;
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <Link
        to="/org/campaigns"
        className="mb-6 flex items-center text-sm font-bold text-buzz-inkMuted transition hover:text-buzz-coral"
      >
        <ChevronLeft size={16} className="mr-1" />
        Back to My Campaigns
      </Link>

      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-buzz-coral px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-buzz-paper">
            {drop.brandName}
          </span>
          <span className="rounded-full border border-buzz-lineMid bg-buzz-paper px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-buzz-inkMuted">
            {ORG_CAMPAIGN_STATUS_LABELS[status]}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-buzz-ink">{drop.title}</h1>
        <p className="mt-2 text-sm font-medium text-buzz-inkMuted">
          {drop.description}
        </p>
      </header>

      {status === "applied" ? (
        <StatusPanel>
          <div className="flex items-start gap-4">
            <ClipboardList size={28} className="mt-1 text-buzz-coral" />
            <div>
              <h2 className="mb-1 text-xl font-bold text-buzz-ink">
                {drop.brandName} is reviewing your application
              </h2>
              <p className="text-sm font-medium text-buzz-inkMuted">
                Submitted on{" "}
                {new Date(application.appliedAt).toLocaleDateString()}. We will
                let you know once a decision has been made.
              </p>
              {application.pitch ? (
                <blockquote className="mt-4 border-l-4 border-buzz-coral bg-buzz-cream p-4 text-sm font-medium italic text-buzz-inkMuted">
                  {application.pitch}
                </blockquote>
              ) : null}
            </div>
          </div>
        </StatusPanel>
      ) : null}

      {status === "accepted" ? (
        <StatusPanel>
          <div className="flex items-start gap-4">
            <Truck size={28} className="mt-1 text-buzz-coral" />
            <div>
              <h2 className="mb-1 text-xl font-bold text-buzz-ink">
                Awaiting product
              </h2>
              <p className="text-sm font-medium text-buzz-inkMuted">
                You are accepted! Your shipment is on the way.
              </p>
              {application.trackingNumber ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-buzz-lineMid bg-buzz-cream px-4 py-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-buzz-inkMuted">
                    Tracking
                  </span>
                  <span className="text-sm font-bold text-buzz-ink">
                    #{application.trackingNumber}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </StatusPanel>
      ) : null}

      {status === "active" ? (
        <div className="space-y-6">
          <AggregateScoreCard
            applicationId={application.id}
            orgId={application.orgId}
          />
          <PostSelector
            applicationId={application.id}
            dropId={application.dropId}
          />
        </div>
      ) : null}

      {status === "finished" ? (
        <div className="space-y-6">
          <AggregateScoreCard
            applicationId={application.id}
            orgId={application.orgId}
          />
          <StatusPanel>
            <h2 className="mb-2 text-xl font-bold text-buzz-ink">
              Final results
            </h2>
            <p className="text-sm font-medium text-buzz-inkMuted">
              This campaign has ended. Your linked posts are read-only — final
              metrics are shown above.
            </p>
          </StatusPanel>
        </div>
      ) : null}
    </div>
  );
}

/** API path: GET /api/campaigns/:id + /aggregate. */
function ApiCampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: detail, isLoading, error } = useCampaignDetail(campaignId);
  const { data: aggregate } = useCampaignAggregate(campaignId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-12 text-center">
        <p className="text-sm font-medium text-buzz-inkMuted">Loading...</p>
      </div>
    );
  }

  if (error || !detail) {
    return <Navigate to="/org/campaigns" replace />;
  }

  const status = apiDeriveStatus(detail);
  if (status == null) {
    return <Navigate to="/org/campaigns" replace />;
  }

  const agg = aggregate ?? {
    postCount: 0,
    likes: 0,
    comments: 0,
    engagement: 0,
    estimatedReach: 0,
  };

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <Link
        to="/org/campaigns"
        className="mb-6 flex items-center text-sm font-bold text-buzz-inkMuted transition hover:text-buzz-coral"
      >
        <ChevronLeft size={16} className="mr-1" />
        Back to My Campaigns
      </Link>

      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-buzz-coral px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-buzz-paper">
            {detail.brandName}
          </span>
          <span className="rounded-full border border-buzz-lineMid bg-buzz-paper px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-buzz-inkMuted">
            {ORG_CAMPAIGN_STATUS_LABELS[status]}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-buzz-ink">{detail.title}</h1>
        <p className="mt-2 text-sm font-medium text-buzz-inkMuted">
          {detail.description ?? ""}
        </p>
      </header>

      {status === "applied" ? (
        <StatusPanel>
          <div className="flex items-start gap-4">
            <ClipboardList size={28} className="mt-1 text-buzz-coral" />
            <div>
              <h2 className="mb-1 text-xl font-bold text-buzz-ink">
                {detail.brandName} is reviewing your application
              </h2>
              <p className="text-sm font-medium text-buzz-inkMuted">
                Submitted on{" "}
                {new Date(detail.appliedAt).toLocaleDateString()}. We will
                let you know once a decision has been made.
              </p>
              {detail.pitch ? (
                <blockquote className="mt-4 border-l-4 border-buzz-coral bg-buzz-cream p-4 text-sm font-medium italic text-buzz-inkMuted">
                  {detail.pitch}
                </blockquote>
              ) : null}
            </div>
          </div>
        </StatusPanel>
      ) : null}

      {status === "accepted" ? (
        <StatusPanel>
          <div className="flex items-start gap-4">
            <Truck size={28} className="mt-1 text-buzz-coral" />
            <div>
              <h2 className="mb-1 text-xl font-bold text-buzz-ink">
                Awaiting product
              </h2>
              <p className="text-sm font-medium text-buzz-inkMuted">
                You are accepted! Your shipment is on the way.
              </p>
              {detail.trackingNumber ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-buzz-lineMid bg-buzz-cream px-4 py-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-buzz-inkMuted">
                    Tracking
                  </span>
                  <span className="text-sm font-bold text-buzz-ink">
                    #{detail.trackingNumber}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </StatusPanel>
      ) : null}

      {(status === "active" || status === "finished") ? (
        <div className="space-y-6">
          <StatusPanel>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="text-center">
                <p className="text-2xl font-black text-buzz-coral">{agg.postCount}</p>
                <p className="text-xs font-bold text-buzz-inkMuted">Posts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-buzz-coral">{agg.likes}</p>
                <p className="text-xs font-bold text-buzz-inkMuted">Likes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-buzz-coral">{agg.comments}</p>
                <p className="text-xs font-bold text-buzz-inkMuted">Comments</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-buzz-coral">{agg.estimatedReach}</p>
                <p className="text-xs font-bold text-buzz-inkMuted">Est. Reach</p>
              </div>
            </div>
          </StatusPanel>
          {status === "finished" ? (
            <StatusPanel>
              <h2 className="mb-2 text-xl font-bold text-buzz-ink">
                Final results
              </h2>
              <p className="text-sm font-medium text-buzz-inkMuted">
                This campaign has ended. Your linked posts are read-only — final
                metrics are shown above.
              </p>
            </StatusPanel>
          ) : null}
          <ApiPostSelector
            applicationId={detail.id}
            readOnly={status === "finished"}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function OrgCampaignDetailPage() {
  return USE_API ? <ApiCampaignDetail /> : <DemoCampaignDetail />;
}
