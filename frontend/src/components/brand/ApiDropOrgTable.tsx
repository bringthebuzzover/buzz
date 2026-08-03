/**
 * API-path per-drop breakdown for the brand drop detail page.
 *
 * Shows each participating org with its attributed totals AND the individual
 * linked posts grouped beneath it (PRODUCT.md §5.3.1 "all social posts ...
 * grouped by org"). A category filter (§5.3.1) narrows the org list client-side.
 */
import { useMemo, useState } from "react";
import type { BrandDropApplicant } from "../../api/hooks/useBrandHooks";
import { orgCategoryLabel } from "../../types/orgCategory";

type Props = {
  applicants: BrandDropApplicant[];
  /** Override the section heading (e.g. roster-only before live). */
  title?: string;
};

export default function ApiDropOrgTable({
  applicants,
  title = "Posts by organization",
}: Props) {
  const accepted = useMemo(
    () => applicants.filter((a) => a.decision === "accepted"),
    [applicants],
  );
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const present = new Set<string>();
    accepted.forEach((a) => {
      if (a.category) present.add(a.category);
    });
    return Array.from(present).sort();
  }, [accepted]);

  const rows =
    category === "all"
      ? accepted
      : accepted.filter((a) => a.category === category);

  if (accepted.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-buzz-lineMid bg-buzz-cream p-8 text-center text-sm font-medium text-buzz-inkMuted">
        No participating organizations yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-buzz-lineMid bg-buzz-paper shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-buzz-line bg-buzz-cream px-6 py-4">
        <h3 className="text-lg font-bold text-buzz-ink">{title}</h3>
        <div className="flex items-center gap-3">
          {categories.length > 0 ? (
            <select
              aria-label="Filter by organization type"
              className="rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-1.5 text-xs font-semibold text-buzz-ink"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All types</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {orgCategoryLabel(c)}
                </option>
              ))}
            </select>
          ) : null}
          <span className="text-xs font-bold text-buzz-inkMuted">
            {rows.length} {rows.length === 1 ? "org" : "orgs"}
          </span>
        </div>
      </div>

      <div className="divide-y divide-buzz-line">
        {rows.map((a) => (
          <div key={a.id} className="px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold text-buzz-ink">{a.orgName}</p>
                <p className="text-xs font-medium text-buzz-inkMuted">
                  {a.university}
                  {a.category ? (
                    <span className="ml-2 rounded-full bg-buzz-butter px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-buzz-ink">
                      {orgCategoryLabel(a.category)}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="text-right text-xs font-semibold text-buzz-inkMuted">
                <span className="text-buzz-ink">{a.attributedPostCount}</span> posts ·{" "}
                <span className="text-buzz-ink">{a.attributedLikes}</span> likes ·{" "}
                <span className="text-buzz-ink">{a.attributedComments}</span> comments ·{" "}
                <span className="text-buzz-coral">{a.attributedEngagement}</span> engagement
              </div>
            </div>

            {a.posts.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {a.posts.map((p) => {
                  const thumb = p.thumbnailUrl || p.mediaUrl;
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-4 rounded-lg border border-buzz-line bg-buzz-cream px-4 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-md object-cover"
                          />
                        ) : null}
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-xs font-semibold text-buzz-coral hover:underline"
                          title={p.caption}
                        >
                          {p.caption || p.url}
                        </a>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold text-buzz-inkMuted">
                        {p.likes} likes · {p.comments} comments
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-xs font-medium text-buzz-inkMuted">
                No linked posts yet.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
