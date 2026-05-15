/**
 * Per-drop posts table for the brand-side drop detail page. PRODUCT.md §5.3.1
 * expects posts grouped by org where useful; this table may roll up or add org
 * context as the UI evolves. Each row is a single post with platform, caption,
 * likes, comments, and estimated reach (the org's follower count).
 */
import { Camera, ExternalLink, Music2 } from "lucide-react";
import { useLinksForDrop, usePosts } from "../../contexts/MockDataContext";
import { SEED_ORGS } from "../../data/seed/seedOrgs";

type PerDropPostsTableProps = {
  dropId: string;
};

export default function PerDropPostsTable({ dropId }: PerDropPostsTableProps) {
  const links = useLinksForDrop(dropId);
  const posts = usePosts();
  const orgsById = new Map(SEED_ORGS.map((o) => [o.id, o]));

  const rows = links
    .map((l) => posts.find((p) => p.id === l.postId))
    .filter(<T,>(p: T | undefined): p is T => p != null);

  return (
    <div className="overflow-hidden rounded-2xl border border-buzz-lineMid bg-buzz-paper shadow-sm">
      <div className="flex items-center justify-between border-b border-buzz-line bg-buzz-cream px-6 py-4">
        <h3 className="text-lg font-bold text-buzz-ink">Posts in this drop</h3>
        <span className="text-xs font-bold text-buzz-inkMuted">
          {rows.length} total
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm font-medium text-buzz-inkMuted">
          No posts have been linked to this drop yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-buzz-cream/60">
              <tr className="border-b border-buzz-line text-xs uppercase tracking-wider text-buzz-inkMuted">
                <th className="px-6 py-3 font-bold">Post</th>
                <th className="px-6 py-3 font-bold">Likes</th>
                <th className="px-6 py-3 font-bold">Comments</th>
                <th className="px-6 py-3 font-bold">Estimated reach</th>
                <th className="px-6 py-3 font-bold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((post) => {
                const orgFollowers = orgsById.get(post.orgId)?.followers ?? 0;
                return (
                  <tr
                    key={post.id}
                    className="border-b border-buzz-line transition hover:bg-buzz-cream/60"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {post.platform === "instagram" ? (
                          <Camera size={16} className="text-buzz-coral" />
                        ) : (
                          <Music2 size={16} className="text-buzz-coral" />
                        )}
                        <span className="text-sm font-bold text-buzz-ink">
                          {post.caption}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold tabular-nums text-buzz-ink">
                      {post.metrics.likes.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold tabular-nums text-buzz-ink">
                      {post.metrics.comments.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold tabular-nums text-buzz-ink">
                      {orgFollowers.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open post"
                        className="inline-flex items-center gap-1 font-bold text-buzz-coral hover:underline"
                      >
                        Open <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
