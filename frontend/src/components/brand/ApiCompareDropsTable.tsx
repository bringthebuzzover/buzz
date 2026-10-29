/**
 * "Compare drops" panel on the brand dashboard (buzz-ops product/PRODUCT.md
 * §5.3.2). Renders from the per-drop totals already returned by
 * `GET /api/brands/me/drops`, highest engagement first, so no extra fetch.
 * Below `md` each drop is a stacked tile instead of a table row.
 */
import { Link } from "react-router-dom";
import type { BrandDropItem } from "../../api/hooks/useBrandHooks";
import { Card, CardHeader } from "../ui/Card";
import { Table, TBody, THead, Td, Th, Tr } from "../ui/Table";
import { entityLinkClass } from "../ui/navItem";
import { SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import { useMdUp } from "../../hooks/useMdUp";
import DropStageBadge from "./DropStageBadge";

export default function ApiCompareDropsTable({ drops }: { drops: BrandDropItem[] }) {
  const mdUp = useMdUp();
  if (drops.length === 0) return null;

  const rows = [...drops].sort((a, b) => b.totalEngagement - a.totalEngagement);

  return (
    <Card kind="panel" pad="card">
      <CardHeader title="Compare drops" className="mb-5" />
      {mdUp ? (
        <Table>
          <THead>
            <tr>
              <Th>Drop</Th>
              <Th className="w-48">Stage</Th>
              <Th className="w-24 text-right">Posts</Th>
              <Th className="w-36 text-right">Engagement</Th>
              <Th className="w-36 text-right">Reach</Th>
            </tr>
          </THead>
          <TBody>
            {rows.map((d, i) => (
              // Pen: the top drop by engagement sits on the yellow wash.
              <Tr key={d.id} className={cn("h-16", i === 0 && "bg-accent-wash")}>
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
