/**
 * Five-tile totals row for the Brand Aggregate Dashboard. Engagement, reach,
 * posts submitted, orgs involved, and campuses reached (PRODUCT.md §5.3.2).
 */
import {
  Building2,
  Camera,
  Eye,
  Heart,
  Users,
} from "lucide-react";
import type { BrandAggregateMetrics } from "../../types/metrics";

type AggregateTotalsCardsProps = {
  metrics: BrandAggregateMetrics;
};

export default function AggregateTotalsCards({
  metrics,
}: AggregateTotalsCardsProps) {
  const tiles = [
    {
      icon: Heart,
      label: "Engagement",
      value: metrics.totalEngagement.toLocaleString(),
    },
    {
      icon: Eye,
      label: "Reach",
      value: metrics.totalReach.toLocaleString(),
    },
    {
      icon: Camera,
      label: "Posts",
      value: metrics.totalPosts.toLocaleString(),
    },
    {
      icon: Users,
      label: "Orgs",
      value: metrics.totalOrgs.toLocaleString(),
    },
    {
      icon: Building2,
      label: "Campuses",
      value: metrics.totalCampuses.toLocaleString(),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="rounded-2xl border border-buzz-lineMid bg-buzz-paper p-5 text-center shadow-sm"
        >
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-buzz-cream">
            <Icon size={20} className="text-buzz-coral" />
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
  );
}
