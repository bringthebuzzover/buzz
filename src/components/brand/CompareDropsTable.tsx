/**
 * Sortable comparison table of all the brand's drops with per-row engagement,
 * reach, posts, and tracker stage. Click a column header to toggle sort.
 */
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import type { Drop } from "../../types/drop";
import type { DropApplication } from "../../types/orgCampaign";
import type { PostCampaignLink, SocialPost } from "../../types/socialPost";
import type { SeedOrg } from "../../data/seed/seedOrgs";
import { computeDropAggregate } from "../../utils/metrics";
import { BRAND_DROP_TRACKER_COPY } from "../../types/brandPortal";

type SortKey =
  | "title"
  | "stage"
  | "engagement"
  | "reach"
  | "posts";

type SortDir = "asc" | "desc";

type CompareDropsTableProps = {
  drops: readonly Drop[];
  applications: readonly DropApplication[];
  links: readonly PostCampaignLink[];
  posts: readonly SocialPost[];
  orgs: readonly SeedOrg[];
};

export default function CompareDropsTable({
  drops,
  applications,
  links,
  posts,
  orgs,
}: CompareDropsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("engagement");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = useMemo(() => {
    return drops
      .map((drop) => {
        const aggregate = computeDropAggregate({
          drop,
          applications,
          links,
          posts,
          orgs,
        });
        return {
          drop,
          stageLabel:
            BRAND_DROP_TRACKER_COPY[drop.brandTrackerStage].label,
          ...aggregate,
        };
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        switch (sortKey) {
          case "title":
            return dir * a.drop.title.localeCompare(b.drop.title);
          case "stage":
            return dir * a.stageLabel.localeCompare(b.stageLabel);
          case "engagement":
            return dir * (a.totalEngagement - b.totalEngagement);
          case "reach":
            return dir * (a.totalReach - b.totalReach);
          case "posts":
            return dir * (a.totalPosts - b.totalPosts);
          default:
            return 0;
        }
      });
  }, [drops, applications, links, posts, orgs, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const indicator = (key: SortKey) => {
    if (sortKey !== key) return <ChevronsUpDown size={12} className="opacity-50" />;
    return sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-buzz-lineMid bg-buzz-paper shadow-sm">
      <div className="border-b border-buzz-line bg-buzz-cream px-6 py-4">
        <h3 className="text-lg font-bold text-buzz-ink">Compare drops</h3>
      </div>
      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm font-medium text-buzz-inkMuted">
          No drops yet to compare.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-buzz-cream/40">
              <tr className="border-b border-buzz-line text-xs uppercase tracking-wider text-buzz-inkMuted">
                {(
                  [
                    { key: "title" as const, label: "Drop" },
                    { key: "stage" as const, label: "Stage" },
                    { key: "engagement" as const, label: "Engagement" },
                    { key: "reach" as const, label: "Reach" },
                    { key: "posts" as const, label: "Posts" },
                  ]
                ).map(({ key, label }) => (
                  <th key={key} className="px-6 py-3 font-bold">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="inline-flex items-center gap-1 hover:text-buzz-coral"
                    >
                      {label} {indicator(key)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.drop.id}
                  className="border-b border-buzz-line transition hover:bg-buzz-cream/60"
                >
                  <td className="px-6 py-4 text-sm font-bold text-buzz-ink">
                    <Link
                      to={`/brand/drops/${row.drop.id}`}
                      className="hover:text-buzz-coral hover:underline"
                    >
                      {row.drop.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-buzz-inkMuted">
                    {row.stageLabel}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold tabular-nums text-buzz-ink">
                    {row.totalEngagement.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold tabular-nums text-buzz-ink">
                    {row.totalReach.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold tabular-nums text-buzz-ink">
                    {row.totalPosts.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
