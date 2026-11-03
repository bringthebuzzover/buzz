/** Shared review queue for organization and brand Instagram requests and org address changes. */
import { Link, Navigate, useSearchParams } from "react-router-dom";
import {
  useAdminBrandIgChangeRequests,
  useAdminIgChangeRequests,
  useAdminShippingChangeRequests,
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
import { formatShippingAddress } from "../../utils/shippingAddress";

const STATUS_FILTERS = [
  { value: null, label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
] as const;

const ACCOUNT_FILTERS = [
  { value: null, label: "Organizations and brands" },
  { value: "organization", label: "Organizations" },
  { value: "brand", label: "Brands" },
] as const;

const CHANGE_FILTERS = [
  { value: null, label: "All changes" },
  { value: "instagram", label: "Instagram" },
  { value: "address", label: "Shipping address" },
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
  const account = searchParams.get("account");
  const change = searchParams.get("change");
  const showOrgInstagram = account !== "brand" && change !== "address";
  const showBrandInstagram = account !== "organization" && change !== "address";
  const showAddress = account !== "brand" && change !== "instagram";
  const orgRequests = useAdminIgChangeRequests(status ?? undefined);
  const brandRequests = useAdminBrandIgChangeRequests(status ?? undefined);
  const addressRequests = useAdminShippingChangeRequests(status ?? undefined);

  if (searchParams.has("type")) {
    const next = new URLSearchParams(searchParams);
    if (!next.has("account")) next.set("account", next.get("type") ?? "");
    next.delete("type");
    return <Navigate to={`/admin/changes?${next.toString()}`} replace />;
  }

  const rows: ListedRequest[] = [];
  if (showOrgInstagram) {
    for (const ticket of orgRequests.data ?? []) {
      rows.push({
        key: `org-instagram-${ticket.id}`,
        type: "Organization",
        name: ticket.orgName ?? "Organization",
        accountTo: `/admin/orgs/${ticket.userId}`,
        change: `${atHandle(ticket.currentHandle)} → ${atHandle(ticket.requestedHandle)}`,
        status: ticket.status,
        createdAt: ticket.createdAt,
        openTo: `/admin/changes/ig/${ticket.id}`,
      });
    }
  }
  if (showBrandInstagram) {
    for (const ticket of brandRequests.data ?? []) {
      rows.push({
        key: `brand-instagram-${ticket.id}`,
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
  if (showAddress) {
    for (const ticket of addressRequests.data ?? []) {
      rows.push({
        key: `org-address-${ticket.id}`,
        type: "Organization",
        name: ticket.orgName ?? "Organization",
        accountTo: `/admin/orgs/${ticket.requesterUserId}`,
        change: `${formatShippingAddress(ticket.currentAddress)} → ${formatShippingAddress(ticket.requestedAddress)}`,
        status: ticket.status,
        createdAt: ticket.createdAt,
        openTo: `/admin/changes/address/${ticket.id}`,
      });
    }
  }
  rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const pending = (showOrgInstagram && orgRequests.isPending) ||
    (showBrandInstagram && brandRequests.isPending) ||
    (showAddress && addressRequests.isPending);
  const failed = (showOrgInstagram && orgRequests.isError) ||
    (showBrandInstagram && brandRequests.isError) ||
    (showAddress && addressRequests.isError);
  const ready = (!showOrgInstagram || Boolean(orgRequests.data)) &&
    (!showBrandInstagram || Boolean(brandRequests.data)) &&
    (!showAddress || Boolean(addressRequests.data));

  return (
    <div>
      <PageHeading
        title="Changes"
        subtitle="Review organization and brand Instagram requests, plus organization shipping address changes."
      />
      <FilterChips options={ACCOUNT_FILTERS} active={account} basePath="/admin/changes" param="account" />
      <FilterChips options={CHANGE_FILTERS} active={change} basePath="/admin/changes" param="change" />
      <FilterChips options={STATUS_FILTERS} active={status} basePath="/admin/changes" param="status" />
      <QueryState isPending={pending} isError={failed} label="change requests" />
      {ready && (
        <AdminTable headers={HEADERS} isEmpty={rows.length === 0} empty="No change requests match this filter.">
          {rows.map((ticket) => (
            <Row key={ticket.key} attention={ticket.status === "pending"}>
              <Cell><Link to={ticket.accountTo} className={entityLinkClass}>{ticket.name}</Link></Cell>
              <Cell>{ticket.type}</Cell>
              <Cell>{ticket.change}</Cell>
              <Cell><Pill tone={statusTone(ticket.status)}>{ticket.status}</Pill></Cell>
              <Cell>{formatDate(ticket.createdAt)}</Cell>
              <Cell align="right"><Link to={ticket.openTo} className={rowActionClass}>Open</Link></Cell>
            </Row>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
