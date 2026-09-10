/**
 * API-path "Compare drops" table for the brand aggregate dashboard
 * (PRODUCT.md §5.3.2). Renders directly from the per-drop aggregates already
 * returned by `GET /api/brands/me/drops` (`BrandDropItem`), so no extra fetch.
 * The demo `CompareDropsTable` recomputes from raw stores and can't take API
 * types — this is its production counterpart.
 */
import { Link } from "react-router-dom";
import type { BrandDropItem } from "../../api/hooks/useBrandHooks";
import {
  BRAND_DROP_TRACKER_COPY,
  type BrandDropTrackerStage,
} from "../../types/brandPortal";
import { Card, CardHeader } from "../ui/Card";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

type Props = {
  drops: BrandDropItem[];
};

function stageLabel(stage: string): string {
  return (
    BRAND_DROP_TRACKER_COPY[stage as BrandDropTrackerStage]?.label ?? stage
  );
}

const cellPad = "px-4 py-3 sm:px-6";

export default function ApiCompareDropsTable({ drops }: Props) {
  if (drops.length === 0) return null;

  // Highest-engagement first so the strongest drops surface at the top.
  const rows = [...drops].sort((a, b) => b.totalEngagement - a.totalEngagement);

  return (
    <Card kind="card" pad="none" className="overflow-hidden">
      <div className="border-b border-buzz-line bg-buzz-cream px-6 py-4">
        <CardHeader title="Compare drops" className="mb-0" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className={cn("border-b border-buzz-line", TEXT.micro, "text-buzz-inkMuted")}>
              <th className={cellPad}>Drop</th>
              <th className={cellPad}>Stage</th>
              <th className={cn(cellPad, "text-right")}>Posts</th>
              <th className={cn(cellPad, "text-right")}>Engagement</th>
              <th className={cn(cellPad, "text-right")}>Reach</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-buzz-line last:border-0">
                <td className={cellPad}>
                  <Link
                    to={`/brand/drops/${d.id}`}
                    className="font-semibold text-buzz-coral hover:underline"
                  >
                    {d.title}
                  </Link>
                </td>
                <td className={cn(cellPad, "text-buzz-inkMuted")}>
                  {stageLabel(d.brandTrackerStage)}
                </td>
                <td className={cn(cellPad, "text-right font-semibold text-buzz-ink")}>
                  {d.totalPosts}
                </td>
                <td className={cn(cellPad, "text-right font-semibold text-buzz-coral")}>
                  {d.totalEngagement}
                </td>
                <td className={cn(cellPad, "text-right text-buzz-ink")}>
                  {d.totalReach}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
