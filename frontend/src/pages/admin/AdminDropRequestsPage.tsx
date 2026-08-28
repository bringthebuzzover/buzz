/**
 * /admin/requests — brand intake tickets awaiting conversion to draft drops.
 */
import { Link, useSearchParams } from "react-router-dom";
import { useAdminDropRequests } from "../../api/hooks/useAdminHooks";
import {
  AdminTable,
  Cell,
  FilterChips,
  PageHeading,
  Panel,
  Pill,
  Row,
} from "../../components/admin/AdminPrimitives";
import { formatDate } from "../../components/admin/labels";

const FILTERS = [
  { value: null, label: "All" },
  { value: "received", label: "Received" },
  { value: "converted", label: "Converted" },
  { value: "closed", label: "Closed" },
] as const;

const HEADERS = ["Brand", "Message", "Status", "Created", ""] as const;

function statusTone(status: string): "good" | "warn" | "neutral" {
  if (status === "converted") return "good";
  if (status === "received") return "warn";
  return "neutral";
}

export default function AdminDropRequestsPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const requests = useAdminDropRequests({
    status: status ?? undefined,
  });

  return (
    <div>
      <PageHeading
        title="Drop requests"
        subtitle="Brand intake tickets. Open one to draft and publish a campaign beside the message."
      />

      <FilterChips
        options={[...FILTERS]}
        active={status}
        basePath="/admin/requests"
        param="status"
      />

      <Panel>
        {requests.isPending && (
          <p className="px-4 py-6 text-sm font-medium text-buzz-inkMuted">
            Loading requests…
          </p>
        )}
        {requests.isError && (
          <p className="px-4 py-6 text-sm font-medium text-red-700">
            Could not load drop requests.
          </p>
        )}
        {requests.data && (
          <AdminTable
            headers={HEADERS}
            isEmpty={requests.data.length === 0}
            empty="No drop requests match this filter."
          >
            {requests.data.map((ticket) => (
              <Row key={ticket.id}>
                <Cell>
                  <Link
                    to={`/admin/brands/${ticket.brandId}`}
                    className="font-semibold text-buzz-ink hover:text-buzz-coral hover:underline"
                  >
                    {ticket.brandName}
                  </Link>
                </Cell>
                <Cell muted>
                  <span className="line-clamp-2">{ticket.message}</span>
                </Cell>
                <Cell>
                  <Pill tone={statusTone(ticket.status)}>{ticket.status}</Pill>
                </Cell>
                <Cell muted>{formatDate(ticket.createdAt)}</Cell>
                <Cell>
                  <Link
                    to={`/admin/requests/${ticket.id}`}
                    className="text-xs font-bold text-buzz-coral hover:underline"
                  >
                    Open
                  </Link>
                </Cell>
              </Row>
            ))}
          </AdminTable>
        )}
      </Panel>
    </div>
  );
}
