/**
 * API-path per-drop breakdown for the brand drop detail page.
 *
 * Shows each participating org with its attributed totals AND the individual
 * linked posts grouped beneath it (buzz-ops product/PRODUCT.md §5.3.1 "all social posts ...
 * grouped by org"). A category filter (§5.3.1) narrows the org list client-side.
 */
import { useMemo, useState } from "react";
import type { BrandDropApplicant } from "../../api/hooks/useBrandHooks";
import { orgCategoryLabel } from "../../types/orgCategory";
import { safeHttpUrl } from "../../utils/safeHttpUrl";
import { Select } from "../forms/controls";
import PostCard from "../posts/PostCard";
import { formatInsightCount } from "../posts/postInsights";
import { Card, CardHeader } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { entityLinkClass } from "../ui/navItem";
import { StatePanel } from "../ui/StatePanel";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import ShipmentList from "../shipments/ShipmentList";
import type { Shipment } from "../../utils/shipments";

function formatFrozenDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
    // Live seats only: a drafted acceptance is not a participant until sent.
    () => applicants.filter((a) => a.decision === "accepted" && a.decisionSentAt != null),
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
    category === "all" ? accepted : accepted.filter((a) => a.category === category);

  if (accepted.length === 0) {
    return <StatePanel>No participating organizations yet.</StatePanel>;
  }

  return (
    <Card kind="panel" pad="card">
      <CardHeader
        title={title}
        description={`${rows.length} ${rows.length === 1 ? "organization" : "organizations"}`}
        actions={
          categories.length > 0 ? (
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
          ) : null
        }
        className="mb-0"
      />

      {rows.map((a) => (
        <section
          key={a.id}
          className="mt-6 flex flex-col gap-5 border-t border-line pt-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
            <div className="min-w-0">
              <h4 className={TEXT.h3}>{a.orgName}</h4>
              {a.accountErased ? (
                <p
                  className={cn(
                    TEXT.body,
                    "mt-1 flex flex-wrap items-center gap-2 text-quiet",
                  )}
                >
                  <Chip>Metrics frozen</Chip>
                  {a.metricsFrozenAt != null
                    ? `Frozen ${formatFrozenDate(a.metricsFrozenAt)}`
                    : null}
                </p>
              ) : (
                <p className={cn(TEXT.body, "mt-1 text-quiet")}>
                  {[a.university, a.category ? orgCategoryLabel(a.category) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <p className={cn(TEXT.body, "tabular-nums text-muted")}>
              {a.attributedPostCount} posts · {a.attributedLikes} likes ·{" "}
              {a.attributedComments} comments · {a.attributedEngagement} engagement
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-10 gap-y-4">
            {a.accountErased ? null : (
              <div className="min-w-0">
                <dt className="text-xs text-quiet">Ship to</dt>
                <dd className={cn(TEXT.body, "mt-1 text-primary")}>
                  {a.deliveryAddress || <AddressPending />}
                </dd>
              </div>
            )}
            <div className="min-w-0">
              <dt className="mb-1 text-xs text-quiet">Shipments</dt>
              <dd>
                <ShipmentList
                  shipments={(a.shipments ?? []) as Shipment[]}
                  empty="None yet"
                  testId={`brand-org-shipments-${a.id}`}
                />
              </dd>
            </div>
          </dl>

          {a.posts.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {a.posts.map((p) => {
                const postHref = safeHttpUrl(p.url);
                return (
                  <PostCard
                    key={p.id}
                    post={p}
                    thumb={p.thumbnailUrl || p.mediaUrl}
                    caption={
                      postHref ? (
                        <a
                          href={postHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={entityLinkClass}
                          title={p.caption}
                        >
                          {p.caption || p.url}
                        </a>
                      ) : (
                        <span title={p.caption}>{p.caption || "Post"}</span>
                      )
                    }
                    meta={`${formatInsightCount(p.likes)} likes · ${formatInsightCount(p.comments)} comments`}
                  />
                );
              })}
            </ul>
          ) : (
            <p className={cn(TEXT.body, "text-quiet")}>No linked posts yet.</p>
          )}
        </section>
      ))}
    </Card>
  );
}

/**
 * Missing ship-to address. Same copy, in the warn/pending tone (`text-accent`,
 * yellow on ink is AA) so the brand sees what still blocks shipping.
 */
export function AddressPending() {
  return (
    <span data-testid="address-pending" className="font-medium text-accent">
      Address pending
    </span>
  );
}
