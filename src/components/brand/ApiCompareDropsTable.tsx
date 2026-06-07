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

type Props = {
  drops: BrandDropItem[];
};

function stageLabel(stage: string): string {
  return (
    BRAND_DROP_TRACKER_COPY[stage as BrandDropTrackerStage]?.label ?? stage
  );
}

export default function ApiCompareDropsTable({ drops }: Props) {
  if (drops.length === 0) return null;

  // Highest-engagement first so the strongest drops surface at the top.
  const rows = [...drops].sort((a, b) => b.totalEngagement - a.totalEngagement);

  return (
    <div className="overflow-hidden rounded-2xl border border-buzz-lineMid bg-buzz-paper shadow-sm">
      <div className="border-b border-buzz-line bg-buzz-cream px-6 py-4">
        <h3 className="text-lg font-bold text-buzz-ink">Compare drops</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-buzz-line text-[11px] font-bold uppercase tracking-wider text-buzz-inkMuted">
              <th className="px-6 py-3">Drop</th>
              <th className="px-6 py-3">Stage</th>
              <th className="px-6 py-3 text-right">Posts</th>
              <th className="px-6 py-3 text-right">Engagement</th>
              <th className="px-6 py-3 text-right">Reach</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-buzz-line last:border-0">
                <td className="px-6 py-3">
                  <Link
                    to={`/brand/drops/${d.id}`}
                    className="font-bold text-buzz-coral hover:underline"
                  >
                    {d.title}
                  </Link>
                </td>
                <td className="px-6 py-3 text-buzz-inkMuted">
                  {stageLabel(d.brandTrackerStage)}
                </td>
                <td className="px-6 py-3 text-right font-semibold text-buzz-ink">
                  {d.totalPosts}
                </td>
                <td className="px-6 py-3 text-right font-semibold text-buzz-coral">
                  {d.totalEngagement}
                </td>
                <td className="px-6 py-3 text-right text-buzz-ink">
                  {d.totalReach}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
