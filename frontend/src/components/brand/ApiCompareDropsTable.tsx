/**
 * "Compare drops" panel on the brand dashboard (buzz-ops product/PRODUCT.md
 * §5.3.2). Renders from the per-drop totals already returned by
 * `GET /api/brands/me/drops`, highest engagement first by default, so no extra fetch.
 * Callers pass published drops only: a draft is a preview, not a result.
 * Below `md` each drop is a stacked tile instead of a table row.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import type { BrandDropItem } from "../../api/hooks/useBrandHooks";
import { Card, CardHeader } from "../ui/Card";
import { Table, TBody, THead, Td, Th, Tr } from "../ui/Table";
import { entityLinkClass } from "../ui/navItem";
import { SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import { useMdUp } from "../../hooks/useMdUp";
import DropStageBadge from "./DropStageBadge";

const metrics = [
  ["totalPosts", "Posts", "w-24"],
  ["totalEngagement", "Engagement", "w-36"],
  ["totalReach", "Reach", "w-36"],
] as const;

export default function ApiCompareDropsTable({ drops }: { drops: BrandDropItem[] }) {
  const mdUp = useMdUp();
  const [sort, setSort] = useState<{
    key: typeof metrics[number][0];
    direction: "descending" | "ascending";
  }>({ key: "totalEngagement", direction: "descending" });
  if (drops.length === 0) return null;

  const rows = [...drops].sort((a, b) =>
    sort.direction === "descending" ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key],
  );

  return (
    <Card kind="panel" pad="card">
      <CardHeader title="Compare drops" className="mb-5" />
      {mdUp ? (
        <Table>
          <THead>
            <tr>
              <Th>Drop</Th>
              <Th className="w-48">Stage</Th>
              {metrics.map(([key, label, width]) => (
                <Th
                  key={key}
                  className={`${width} text-right`}
                  aria-sort={sort.key === key ? sort.direction : "none"}
                >
                  <button
                    type="button"
                    onClick={() => setSort((current) => ({
                      key,
                      direction: current.key === key && current.direction === "descending"
                        ? "ascending" : "descending",
                    }))}
                  >
                    {label}
                  </button>
                </Th>
              ))}
            </tr>
          </THead>
          <TBody>
            {rows.map((d) => (
              <Tr key={d.id} className="h-16">
                <Td>
                  <Link to={`/brand/drops/${d.id}`} className={entityLinkClass}>
                    {d.title}
                  </Link>
                </Td>
                <Td>
                  <DropStageBadge stage={d.stage} />
                </Td>
                <Td className="text-right tabular-nums">{d.totalPosts}</Td>
                <Td className="text-right tabular-nums">{d.totalEngagement}</Td>
                <Td className="text-right tabular-nums">{d.totalReach}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((d) => (
            <li key={d.id} className={cn(SURFACE.inset, "flex flex-col gap-2 p-4")}>
              <Link to={`/brand/drops/${d.id}`} className={entityLinkClass}>
                {d.title}
              </Link>
              <DropStageBadge stage={d.stage} />
              <p className={cn(TEXT.body, "text-muted")}>
                {d.totalPosts} posts · {d.totalEngagement} engagement · {d.totalReach}{" "}
                reach
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
