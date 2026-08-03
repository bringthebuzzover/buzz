/**
 * /admin/orgs — every student-org account, filterable by status.
 *
 * The pending-approval queue is a filter on this one table rather than its own
 * page, so the queue and the full list can never disagree about what a row looks
 * like. `?status=` drives the filter, which keeps every view shareable.
 */
import { Link, useSearchParams } from "react-router-dom";
import {
  useAdminOrgs,
  useApproveOrg,
  useDenyOrg,
  useViewAs,
  type AdminOrgRow,
} from "../../api/hooks/useAdminHooks";
import {
  ActionButton,
  AdminTable,
  Cell,
  ErrorNote,
  FilterChips,
  PageHeading,
  Panel,
  Row,
  StatusPill,
} from "../../components/admin/AdminPrimitives";
import { formatElapsed } from "../../components/admin/labels";

const FILTERS = [
  { value: null, label: "All" },
  { value: "pending_approval", label: "Awaiting approval" },
  { value: "pending_email_verification", label: "Unverified" },
  { value: "pending_org_profile", label: "No profile" },
  { value: "active", label: "Active" },
  { value: "denied", label: "Denied" },
] as const;

const HEADERS = [
  "Organization",
  "University",
  "Status",
  "Contact",
  "Waiting",
  "",
] as const;

export default function AdminOrgsPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const orgs = useAdminOrgs(status ?? undefined);
  const approve = useApproveOrg();
  const deny = useDenyOrg();
  const { viewAs, error: viewAsError, isPending: viewAsPending } = useViewAs();

  const busy = approve.isPending || deny.isPending;
  const actionError = approve.isError || deny.isError;

  const decidable = (row: AdminOrgRow) =>
    row.status === "pending_approval" && row.id !== null;

  return (
    <div>
      <PageHeading
        title="Organizations"
        subtitle="Student orgs across every onboarding state. Approve or deny from the awaiting-approval filter."
      />

      {viewAsError && <ErrorNote>{viewAsError}</ErrorNote>}
      {actionError && (
        <ErrorNote>
          That decision did not go through. Reload and try again.
        </ErrorNote>
      )}

      <FilterChips
        options={FILTERS}
        active={status}
        basePath="/admin/orgs"
        param="status"
      />

      <Panel>
        {orgs.isPending && (
          <p className="px-4 py-6 text-sm font-medium text-buzz-inkMuted">
            Loading organizations…
          </p>
        )}
        {orgs.isError && (
          <p className="px-4 py-6 text-sm font-medium text-red-700">
            Could not load organizations.
          </p>
        )}
        {orgs.data && (
          <AdminTable
            headers={HEADERS}
            isEmpty={orgs.data.length === 0}
            empty="No organizations match this filter."
          >
            {orgs.data.map((row) => (
              <Row key={row.userId}>
                <Cell>
                  <Link
                    to={`/admin/orgs/${row.userId}`}
                    className="font-semibold text-buzz-ink hover:text-buzz-coral hover:underline"
                  >
                    {row.orgName ?? "Profile not submitted"}
                  </Link>
                  {row.instagramHandle && (
                    <span className="ml-2 text-xs font-medium text-buzz-inkMuted">
                      @{row.instagramHandle.replace(/^@/, "")}
                    </span>
                  )}
                </Cell>
                <Cell muted>{row.university ?? "—"}</Cell>
                <Cell>
                  <StatusPill status={row.status} />
                </Cell>
                <Cell muted>{row.eduEmail ?? "—"}</Cell>
                <Cell muted>{formatElapsed(row.createdAt)}</Cell>
                <Cell align="right">
                  <div className="flex justify-end gap-2">
                    {decidable(row) && (
                      <>
                        <ActionButton
                          variant="primary"
                          testId={`approve-org-${row.userId}`}
                          disabled={busy}
                          onClick={() => approve.mutate(row.id as string)}
                        >
                          Approve
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          testId={`deny-org-${row.userId}`}
                          disabled={busy}
                          onClick={() => deny.mutate(row.id as string)}
                        >
                          Deny
                        </ActionButton>
                      </>
                    )}
                    <ActionButton
                      testId={`view-as-${row.userId}`}
                      disabled={!row.impersonatable || viewAsPending}
                      onClick={() => void viewAs(row.userId)}
                    >
                      View as
                    </ActionButton>
                  </div>
                </Cell>
              </Row>
            ))}
          </AdminTable>
        )}
      </Panel>
    </div>
  );
}
