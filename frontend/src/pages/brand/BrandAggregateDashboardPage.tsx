/**
 * `/brand/dashboard` — Brand Aggregate Dashboard (buzz-ops product/PRODUCT.md §5.3.2).
 *
 * Renders from the real backend (GET /api/brands/me/aggregate,
 * /api/brands/me/drops, /api/brands/me/drop-requests,
 * /api/brands/me/engagement-series).
 */
import { Link, useLocation } from "react-router-dom";
import AggregateTotalsCards from "../../components/brand/AggregateTotalsCards";
import ApiCompareDropsTable from "../../components/brand/ApiCompareDropsTable";
import EngagementOverTimeChart from "../../components/brand/EngagementOverTimeChart";
import {
  useBrandAggregate,
  useBrandDropRequests,
  useBrandDrops,
  useEngagementSeries,
  type BrandDropItem,
  type BrandDropRequest,
} from "../../api/hooks/useBrandHooks";
import DropStageBadge from "../../components/brand/DropStageBadge";
import type { BrandAggregate, EngagementPoint } from "../../api/hooks/useBrandHooks";
import PageShell from "../../components/site/PageShell";
import { LinkButton, SuccessBanner } from "../../components/forms/controls";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge, Chip } from "../../components/ui/Chip";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { QueryStatePanel, StatePanel } from "../../components/ui/StatePanel";
import { Table, TBody, THead, Td, Th, Tr } from "../../components/ui/Table";
import { quietLinkClass } from "../../components/ui/navItem";
import { useMdUp } from "../../hooks/useMdUp";
import { SURFACE, STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

function DashboardHeader() {
  return (
    <PageHeader
      kicker="Brand Portal"
      title="Dashboard"
      description="Totals across every drop you've run with BUZZ."
      actions={
        <LinkButton to="/brand/requests/new" data-testid="plan-campaign">
          New request
        </LinkButton>
      }
      className="mb-0"
    />
  );
}

/** Request status badge. Received is the open wash; a built drop is done. */
function RequestStatus({ status }: { status: string }) {
  if (status === "received") return <Badge>Received</Badge>;
  if (status === "converted") return <Chip dot>Drop built</Chip>;
  return <Chip>{status === "closed" ? "Closed" : status.replace(/_/g, " ")}</Chip>;
}

/** Title when the brand gave one; otherwise the first line of the message. */
export function requestListLabel(ticket: {
  title?: string | null;
  message: string;
}): string {
  const title = ticket.title?.trim();
  if (title) return title;
  const first = ticket.message.split(/\r?\n/).find((line) => line.trim());
  return (first ?? ticket.message).trim();
}

function sentDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ViewDropLink({ ticket }: { ticket: BrandDropRequest }) {
  return ticket.convertedDropId ? (
    <Link to={`/brand/drops/${ticket.convertedDropId}`} className={quietLinkClass}>
      View drop
    </Link>
  ) : null;
}

function RequestsPanel({ tickets }: { tickets: BrandDropRequest[] }) {
  const mdUp = useMdUp();
  return (
    <Card kind="panel" pad="card" className="scroll-mt-24" id="tickets">
      <CardHeader
        title="Requests"
        description="Campaigns you asked for. A BUZZ representative contacts you about each one."
        className="mb-5"
      />
      {tickets.length === 0 ? (
        <EmptyState>
          No requests yet. Use New request to tell us about your campaign.
        </EmptyState>
      ) : mdUp ? (
        <Table>
          <THead>
            <tr>
              <Th>Request</Th>
              <Th className="w-40">Status</Th>
              <Th className="w-40">Sent</Th>
              <Th className="w-28">
                <span className="sr-only">Drop</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {tickets.map((ticket) => (
              <Tr key={ticket.id} className="h-16" data-testid="drop-request-row">
                <Td className="max-w-0">
                  <span className="line-clamp-2">{requestListLabel(ticket)}</span>
                </Td>
                <Td>
                  <RequestStatus status={ticket.status} />
                </Td>
                <Td>{sentDate(ticket.createdAt)}</Td>
                <Td>
                  <ViewDropLink ticket={ticket} />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      ) : (
        <ul className="flex flex-col gap-3">
          {tickets.map((ticket) => (
            <li
              key={ticket.id}
              className={cn(SURFACE.inset, "flex flex-col gap-2 p-4")}
              data-testid="drop-request-row"
            >
              <p className={cn(TEXT.body, "line-clamp-2 text-primary")}>
                {requestListLabel(ticket)}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <RequestStatus status={ticket.status} />
                <span className={cn(TEXT.body, "text-quiet")}>
                  {sentDate(ticket.createdAt)}
                </span>
                <ViewDropLink ticket={ticket} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Drops BUZZ is still building. Orgs can't see them yet. */
function DraftsPanel({ drafts }: { drafts: BrandDropItem[] }) {
  return (
    <Card kind="panel" pad="card" data-testid="brand-drafts">
      <CardHeader
        title="Drafts"
        description="BUZZ is building these. Orgs can't see them until they're published."
        className="mb-5"
      />
      <ul className="flex flex-col gap-3">
        {drafts.map((d) => (
          <li
            key={d.id}
            className={cn(SURFACE.inset, "flex flex-wrap items-center gap-3 p-4")}
          >
            <Link to={`/brand/drops/${d.id}`} className={quietLinkClass}>
              {d.title}
            </Link>
            <DropStageBadge stage={d.stage} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Map backend aggregate shape to what components expect. */
function mapAggregate(a: BrandAggregate) {
  return {
    brandId: "",
    totalDrops: a.totalDrops,
    totalPosts: a.totalPosts,
    totalLikes: a.totalLikes,
    totalComments: a.totalComments,
    totalEngagement: a.totalEngagement,
    totalReach: a.totalReach,
    totalOrgs: a.totalOrgs,
    totalCampuses: a.totalCampuses,
  };
}

function mapEngagementSeries(points: EngagementPoint[]) {
  return points.map((p) => ({
    timestamp: p.timestamp,
    engagement: p.engagement,
  }));
}

function ApiDashboard() {
  const location = useLocation();
  const ticketSubmitted = Boolean(
    (location.state as { ticketSubmitted?: boolean } | null)?.ticketSubmitted,
  );
  const {
    data: aggregate,
    isLoading: aggLoading,
    isError: aggError,
  } = useBrandAggregate();
  const { data: drops, isLoading: dropsLoading, isError: dropsError } = useBrandDrops();
  const {
    data: requests,
    isLoading: requestsLoading,
    isError: requestsError,
  } = useBrandDropRequests();
  const {
    data: series,
    isLoading: seriesLoading,
    isError: seriesError,
  } = useEngagementSeries();

  // Engagement series is chart-only — don't fail the whole dashboard if it errors.
  const isLoading = aggLoading || dropsLoading || requestsLoading;
  const isError = aggError || dropsError || requestsError;

  if (isLoading || isError) {
    return (
      <PageShell width="wide" className={STACK.section}>
        <DashboardHeader />
        <QueryStatePanel isPending={isLoading} isError={isError} label="dashboard" />
      </PageShell>
    );
  }

  // Drafts are previews: listed on their own, never in totals or Compare.
  const all: BrandDropItem[] = drops ?? [];
  const items = all.filter((d) => d.stage !== "draft");
  const drafts = all.filter((d) => d.stage === "draft");
  const tickets = requests ?? [];
  const agg = aggregate ?? {
    totalDrops: 0,
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalEngagement: 0,
    totalReach: 0,
    totalOrgs: 0,
    totalCampuses: 0,
  };

  return (
    <PageShell width="wide" className={STACK.section}>
      <DashboardHeader />
      {ticketSubmitted ? (
        <div data-testid="ticket-submitted-toast">
          <SuccessBanner>
            Request sent. A BUZZ representative will contact you.
          </SuccessBanner>
        </div>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title="No drops yet">
          After a BUZZ representative builds your campaign and publishes it, performance
          shows up here.
        </EmptyState>
      ) : (
        <>
          <AggregateTotalsCards metrics={mapAggregate(agg)} />
          {seriesError ? (
            <StatePanel>Engagement over time is temporarily unavailable.</StatePanel>
          ) : seriesLoading ? (
            <StatePanel>Loading engagement chart…</StatePanel>
          ) : (
            <EngagementOverTimeChart points={mapEngagementSeries(series ?? [])} />
          )}
          <ApiCompareDropsTable drops={items} />
        </>
      )}
      {drafts.length > 0 ? <DraftsPanel drafts={drafts} /> : null}
      <RequestsPanel tickets={tickets} />
    </PageShell>
  );
}

export default function BrandAggregateDashboardPage() {
  return <ApiDashboard />;
}
