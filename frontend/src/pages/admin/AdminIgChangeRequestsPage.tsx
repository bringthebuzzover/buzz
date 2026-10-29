/**
 * /admin/ig-changes — org identity tickets and brand caption-handle tickets.
 *
 * The two queues stay on separate endpoints. This page merges them and filters
 * by type in the URL. Brand approval only writes the caption @.
 */
import { Link, useSearchParams } from "react-router-dom";
import {
  useAdminBrandIgChangeRequests,
  useAdminIgChangeRequests,
} from "../../api/hooks/useAdminHooks";
import {
  AdminTable,
  Cell,
  FilterChips,
  PageHeading,
  Pill,
  entityLinkClass,
  QueryState,
  Row,
  rowActionClass,
} from "../../components/admin/AdminPrimitives";
import { formatDate } from "../../components/admin/labels";

const STATUS_FILTERS = [
  { value: null, label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
] as const;

const TYPE_FILTERS = [
  { value: null, label: "Organizations and brands" },
  { value: "organization", label: "Organizations" },
  { value: "brand", label: "Brands" },
] as const;

const HEADERS = ["Account", "Type", "Change", "Status", "Created", ""] as const;

type ListedRequest = {
  key: string;
  type: "Organization" | "Brand";
  name: string;
  accountTo: string;
  change: string;
  status: string;
  createdAt: number | null;
  openTo: string;
};

function statusTone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (status === "approved") return "good";
  if (status === "pending") return "warn";
  if (status === "denied") return "bad";
  return "neutral";
}

function atHandle(raw: string): string {
  const handle = raw.replace(/^@/, "").trim();
  return handle ? `@${handle}` : "—";
}

export default function AdminIgChangeRequestsPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const orgRequests = useAdminIgChangeRequests(status ?? undefined);
  const brandRequests = useAdminBrandIgChangeRequests(status ?? undefined);

  const rows: ListedRequest[] = [];
  if (type !== "brand") {
    for (const ticket of orgRequests.data ?? []) {
      rows.push({
        key: `org-${ticket.id}`,
        type: "Organization",
        name: ticket.orgName ?? "Organization",
        accountTo: `/admin/orgs/${ticket.userId}`,
        change: `${atHandle(ticket.currentHandle)} → ${atHandle(ticket.requestedHandle)}`,
        status: ticket.status,
        createdAt: ticket.createdAt,
        openTo: `/admin/ig-changes/${ticket.id}`,
      });
    }
  }
  if (type !== "organization") {
    for (const ticket of brandRequests.data ?? []) {
      rows.push({
        key: `brand-${ticket.id}`,
        type: "Brand",
        name: ticket.brandName,
        accountTo: `/admin/brands/${ticket.brandId}`,
        change: `${atHandle(ticket.currentHandle)} → ${atHandle(ticket.requestedHandle)}`,
        status: ticket.status,
        createdAt: ticket.createdAt,
        openTo: `/admin/brands/${ticket.brandId}`,
      });
    }
  }
  rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const ready = Boolean(orgRequests.data) && Boolean(brandRequests.data);

  return (
    <div>
      <PageHeading
        title="Instagram identity requests"
        subtitle="Organizations: a rename stays a login; an account switch needs a tester add, then Connect. Brands: approval only updates the caption @."
      />

      <FilterChips
        options={[...TYPE_FILTERS]}
        active={type}
        basePath="/admin/ig-changes"
        param="type"
      />
      <FilterChips
        options={[...STATUS_FILTERS]}
        active={status}
        basePath="/admin/ig-changes"
        param="status"
      />

      <QueryState
        isPending={orgRequests.isPending || brandRequests.isPending}
        isError={orgRequests.isError || brandRequests.isError}
        label="Instagram identity requests"
      />
      {ready && (
        <AdminTable
          headers={HEADERS}
          isEmpty={rows.length === 0}
          empty="No Instagram identity requests match this filter."
        >
          {rows.map((ticket) => (
            <Row key={ticket.key} attention={ticket.status === "pending"}>
              <Cell>
                <Link
                  to={ticket.accountTo}
                  className={entityLinkClass}
                >
                  {ticket.name}
                </Link>
              </Cell>
              <Cell>{ticket.type}</Cell>
              <Cell>{ticket.change}</Cell>
              <Cell>
                <Pill tone={statusTone(ticket.status)}>{ticket.status}</Pill>
              </Cell>
              <Cell>{formatDate(ticket.createdAt)}</Cell>
              <Cell align="right">
                <Link to={ticket.openTo} className={rowActionClass}>
                  Open
                </Link>
              </Cell>
            </Row>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
