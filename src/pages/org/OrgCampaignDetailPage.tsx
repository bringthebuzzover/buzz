/**
 * `/org/campaigns/:campaignId` — per-status detail view. Renders different bodies
 * based on the derived `OrgCampaignStatus`:
 *
 * - Applied: submitted date + "Buzz is reviewing your application".
 * - Waitlisted: explanation copy.
 * - Accepted: tracking number block + "Awaiting product".
 * - Active: `PostSelector` + `AggregateScoreCard`.
 * - Finished: read-only summary of linked posts + final aggregate.
 *
 * Denied applications are unreachable here because they are filtered out of
 * My Campaigns; defensively, this page still redirects to the list.
 */
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronLeft, ClipboardList, Clock, Truck } from "lucide-react";
import {
  useApplications,
  useDrops,
} from "../../contexts/MockDataContext";
import { deriveOrgCampaignStatus } from "../../utils/orgCampaignStatus";
import { ORG_CAMPAIGN_STATUS_LABELS } from "../../types/orgCampaign";
import PostSelector from "../../components/org/PostSelector";
import AggregateScoreCard from "../../components/org/AggregateScoreCard";
import { DEMO_ORG_ID } from "../../data/seed/seedOrgs";

function StatusPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-buzz-lineMid bg-buzz-paper p-8 shadow-sm">
      {children}
    </div>
  );
}

export default function OrgCampaignDetailPage() {
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
                Buzz is reviewing your application
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

      {status === "waitlisted" ? (
        <StatusPanel>
          <div className="flex items-start gap-4">
            <Clock size={28} className="mt-1 text-buzz-coral" />
            <div>
              <h2 className="mb-1 text-xl font-bold text-buzz-ink">
                You are on the waitlist
              </h2>
              <p className="text-sm font-medium text-buzz-inkMuted">
                This drop has filled all spots, but we will bump you to accepted
                if anyone drops out. We will email you the moment that happens.
              </p>
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
