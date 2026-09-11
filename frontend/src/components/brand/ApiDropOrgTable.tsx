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
import { safeHttpUrl } from "../../utils/safeHttpUrl";
import { Select } from "../forms/controls";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { StatePanel } from "../ui/StatePanel";
import { SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

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
    return <StatePanel>No participating organizations yet.</StatePanel>;
  }

  return (
    <Card kind="card" pad="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-buzz-line bg-buzz-cream px-6 py-4">
        <h3 className={TEXT.h3}>{title}</h3>
        <div className="flex items-center gap-3">
          {categories.length > 0 ? (
            <Select
              aria-label="Filter by organization type"
              size="compact"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All types</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {orgCategoryLabel(c)}
                </option>
              ))}
            </Select>
          ) : null}
          <span className={TEXT.meta}>
            {rows.length} {rows.length === 1 ? "org" : "orgs"}
          </span>
        </div>
      </div>

      <div className="divide-y divide-buzz-line">
        {rows.map((a) => (
          <div key={a.id} className="px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={cn(TEXT.body, "font-semibold text-buzz-ink")}>
                  {a.orgName}
                </p>
                <p className={cn(TEXT.meta, "flex flex-wrap items-center gap-2")}>
                  {a.university}
                  {a.category ? (
                    <Chip>{orgCategoryLabel(a.category)}</Chip>
                  ) : null}
                  {a.accountErased ? (
                    <span>· Account deleted</span>
                  ) : null}
                </p>
                {a.accountErased ? (
                  <p className={cn(TEXT.meta, "mt-1")}>
                    Shipping details removed
                  </p>
                ) : a.deliveryAddress ? (
                  <p className={cn(TEXT.meta, "mt-1")}>
                    Ship to: {a.deliveryAddress}
                  </p>
                ) : (
                  <p className={cn(TEXT.meta, "mt-1 text-buzz-warn")}>
                    Ship to: Not set — nowhere to ship product
                  </p>
                )}
              </div>
              <div className={cn(TEXT.meta, "text-right font-semibold")}>
                <span className="text-buzz-ink">{a.attributedPostCount}</span> posts ·{" "}
                <span className="text-buzz-ink">{a.attributedLikes}</span> likes ·{" "}
                <span className="text-buzz-ink">{a.attributedComments}</span> comments ·{" "}
                <span className="text-buzz-coral">{a.attributedEngagement}</span> engagement
              </div>
            </div>

            {a.posts.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {a.posts.map((p) => {
                  const thumb = safeHttpUrl(p.thumbnailUrl || p.mediaUrl);
                  const postHref = safeHttpUrl(p.url);
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        SURFACE.inset,
                        "flex items-center justify-between gap-4 px-4 py-2",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-buzzControl object-cover"
                          />
                        ) : null}
                        {postHref ? (
                          <a
                            href={postHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-xs font-semibold text-buzz-coral hover:underline"
                            title={p.caption}
                          >
                            {p.caption || p.url}
                          </a>
                        ) : (
                          <span
                            className="truncate text-xs font-semibold text-buzz-inkMuted"
                            title={p.caption}
                          >
                            {p.caption || "Post"}
                          </span>
                        )}
                      </div>
                      <span className={cn(TEXT.meta, "shrink-0")}>
                        {p.likes} likes · {p.comments} comments
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={cn(TEXT.meta, "mt-2")}>No linked posts yet.</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
