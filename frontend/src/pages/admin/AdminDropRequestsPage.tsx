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
  Pill,
  QueryState,
  Row,
  rowActionClass,
} from "../../components/admin/AdminPrimitives";
import { formatDate } from "../../components/admin/labels";

const FILTERS = [
  { value: null, label: "All" },
  { value: "received", label: "Received" },
  { value: "converted", label: "Converted" },
  { value: "closed", label: "Closed" },
] as const;

const HEADERS = ["Brand", "Request", "Status", "Created", ""] as const;

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

      <QueryState
        isPending={requests.isPending}
        isError={requests.isError}
        label="drop requests"
      />
      {requests.data && (
        <AdminTable
          headers={HEADERS}
          isEmpty={requests.data.length === 0}
          empty="No drop requests match this filter."
        >
          {requests.data.map((ticket) => {
            const title = ticket.title?.trim();
            const primary = title || ticket.message;
            return (
              <Row key={ticket.id} attention={ticket.status === "received"}>
                <Cell>
                  <Link
                    to={`/admin/brands/${ticket.brandId}`}
                    className="text-primary hover:text-accent"
                  >
                    {ticket.brandName}
                  </Link>
                </Cell>
                <Cell>
                  <span className="block">{primary}</span>
                  {title && title !== ticket.message ? (
                    <span className="mt-0.5 line-clamp-2 block text-xs text-quiet">
                      {ticket.message}
                    </span>
                  ) : null}
                </Cell>
                <Cell>
                  <Pill tone={statusTone(ticket.status)}>{ticket.status}</Pill>
                </Cell>
                <Cell>{formatDate(ticket.createdAt)}</Cell>
                <Cell align="right">
                  <Link
                    to={`/admin/requests/${ticket.id}`}
                    className={rowActionClass}
                  >
                    Open
                  </Link>
                </Cell>
              </Row>
            );
          })}
        </AdminTable>
      )}
    </div>
  );
}
