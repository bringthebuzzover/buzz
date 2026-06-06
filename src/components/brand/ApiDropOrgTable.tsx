/**
 * API-path per-drop breakdown for the brand drop detail page.
 *
 * The brand drop-detail endpoint returns per-org *attributed* totals (posts,
 * likes, comments, engagement) rather than individual posts, so this table
 * groups by accepted org — the API equivalent of the demo `PerDropPostsTable`.
 */
import type { BrandDropApplicant } from "../../api/hooks/useBrandHooks";

type Props = {
  applicants: BrandDropApplicant[];
};

export default function ApiDropOrgTable({ applicants }: Props) {
  const accepted = applicants.filter((a) => a.decision === "accepted");

  if (accepted.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-buzz-lineMid bg-buzz-cream p-8 text-center text-sm font-medium text-buzz-inkMuted">
        No participating organizations yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-buzz-lineMid bg-buzz-paper shadow-sm">
      <div className="flex items-center justify-between border-b border-buzz-line bg-buzz-cream px-6 py-4">
        <h3 className="text-lg font-bold text-buzz-ink">Posts by organization</h3>
        <span className="text-xs font-bold text-buzz-inkMuted">
          {accepted.length} {accepted.length === 1 ? "org" : "orgs"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-buzz-line text-[11px] font-bold uppercase tracking-wider text-buzz-inkMuted">
              <th className="px-6 py-3">Organization</th>
              <th className="px-6 py-3 text-right">Posts</th>
              <th className="px-6 py-3 text-right">Likes</th>
              <th className="px-6 py-3 text-right">Comments</th>
              <th className="px-6 py-3 text-right">Engagement</th>
            </tr>
          </thead>
          <tbody>
            {accepted.map((a) => (
              <tr key={a.id} className="border-b border-buzz-line last:border-0">
                <td className="px-6 py-3">
                  <p className="font-bold text-buzz-ink">{a.orgName}</p>
                  <p className="text-xs font-medium text-buzz-inkMuted">
                    {a.university}
                  </p>
                </td>
                <td className="px-6 py-3 text-right font-semibold text-buzz-ink">
                  {a.attributedPostCount}
                </td>
                <td className="px-6 py-3 text-right text-buzz-ink">
                  {a.attributedLikes}
                </td>
                <td className="px-6 py-3 text-right text-buzz-ink">
                  {a.attributedComments}
                </td>
                <td className="px-6 py-3 text-right font-semibold text-buzz-coral">
                  {a.attributedEngagement}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
