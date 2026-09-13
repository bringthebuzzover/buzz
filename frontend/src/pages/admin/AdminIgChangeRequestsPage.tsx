/**
 * /admin/ig-changes — org Instagram identity-change tickets (PRODUCT §3.1.4).
 */
import { Link, useSearchParams } from "react-router-dom";
import { useAdminIgChangeRequests } from "../../api/hooks/useAdminHooks";
import { LinkButton } from "../../components/forms/controls";
import {
  AdminTable,
  Cell,
  FilterChips,
  PageHeading,
  Panel,
  Pill,
  QueryState,
  Row,
} from "../../components/admin/AdminPrimitives";
import { formatDate } from "../../components/admin/labels";

const FILTERS = [
  { value: null, label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
] as const;

const HEADERS = ["Org", "Change", "Status", "Created", ""] as const;

function statusTone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (status === "approved") return "good";
  if (status === "pending") return "warn";
  if (status === "denied") return "bad";
  return "neutral";
}

export default function AdminIgChangeRequestsPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const requests = useAdminIgChangeRequests(status ?? undefined);

  return (
    <div>
      <PageHeading
        title="Instagram identity requests"
        subtitle="Rename stays a login; account switch needs tester add, then Connect."
      />

      <FilterChips
        options={[...FILTERS]}
        active={status}
        basePath="/admin/ig-changes"
        param="status"
      />

      <Panel>
        <QueryState
          isPending={requests.isPending}
          isError={requests.isError}
          label="Instagram identity requests"
        />
        {requests.data && (
          <AdminTable
            headers={HEADERS}
            isEmpty={requests.data.length === 0}
            empty="No Instagram identity requests match this filter."
          >
            {requests.data.map((ticket) => (
              <Row key={ticket.id}>
                <Cell>
                  <Link
                    to={`/admin/orgs/${ticket.userId}`}
                    className="font-semibold text-buzz-ink hover:text-buzz-coral hover:underline"
                  >
                    {ticket.orgName ?? "Organization"}
                  </Link>
                </Cell>
                <Cell muted>
                  @{ticket.currentHandle} → @{ticket.requestedHandle}
                </Cell>
                <Cell>
                  <Pill tone={statusTone(ticket.status)}>{ticket.status}</Pill>
                </Cell>
                <Cell muted>{formatDate(ticket.createdAt)}</Cell>
                <Cell align="right">
                  <LinkButton
                    to={`/admin/ig-changes/${ticket.id}`}
                    size="compact"
                    variant="outline"
                  >
                    Open
                  </LinkButton>
                </Cell>
              </Row>
            ))}
          </AdminTable>
        )}
      </Panel>
    </div>
  );
}
