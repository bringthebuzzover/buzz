/**
 * Aggregate engagement card shown on Active and Finished org campaign pages.
 * Sums likes/comments across the org's linked posts plus the org's estimated
 * reach (its follower count). Numbers update live as posts are linked/unlinked
 * and as the demo clock refreshes metrics.
 */
import { Heart, MessageCircle, Sparkles, Users } from "lucide-react";
import {
  useLinksForCampaign,
  usePostsForOrg,
} from "../../contexts/MockDataContext";
import { computeCampaignAggregate } from "../../utils/metrics";
import { SEED_ORGS } from "../../data/seed/seedOrgs";

type AggregateScoreCardProps = {
  applicationId: string;
  orgId: string;
};

export default function AggregateScoreCard({
  applicationId,
  orgId,
}: AggregateScoreCardProps) {
  const links = useLinksForCampaign(applicationId);
  const posts = usePostsForOrg(orgId);
  const org = SEED_ORGS.find((o) => o.id === orgId);
  const followers = org?.followers ?? 0;

  const aggregate = computeCampaignAggregate({
    applicationId,
    links,
    posts,
    orgFollowers: followers,
  });

  const stats = [
    {
      icon: Sparkles,
      label: "Engagement",
      value: aggregate.engagement.toLocaleString(),
    },
    {
      icon: Heart,
      label: "Likes",
      value: aggregate.likes.toLocaleString(),
    },
    {
      icon: MessageCircle,
      label: "Comments",
      value: aggregate.comments.toLocaleString(),
    },
    {
      icon: Users,
      label: "Estimated Reach",
      value: aggregate.estimatedReach.toLocaleString(),
    },
  ];

  return (
    <div className="rounded-2xl border border-buzz-lineMid bg-buzz-butter p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-buzz-ink">Digital Performance</h3>
        <span className="text-xs font-bold text-buzz-inkMuted">
          {aggregate.postCount} linked post{aggregate.postCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-buzz-lineMid bg-buzz-paper p-4 text-center"
          >
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-buzz-cream">
              <Icon size={18} className="text-buzz-coral" />
            </div>
            <div className="text-2xl font-black tabular-nums text-buzz-ink">
              {value}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-buzz-inkMuted">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
