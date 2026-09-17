/**
 * /admin/orgs — every student-org account, filterable by status.
 *
 * The pending-approval queue is a filter on this one table rather than its own
 * page, so the queue and the full list can never disagree about what a row looks
 * like. `?status=` drives the filter, which keeps every view shareable.
 */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import {
  useAdminOrgs,
  useDenyOrg,
  useResendAllPendingInstagramConnect,
  useViewAs,
  type AdminOrgRow,
  type ResendConnectAllResult,
} from "../../api/hooks/useAdminHooks";
import {
  ActionButton,
  AdminTable,
  Cell,
  ErrorNote,
  FilterChips,
  PageHeading,
  Panel,
  QueryState,
  Row,
  StatusPill,
  UnconfirmedIgChip,
} from "../../components/admin/AdminPrimitives";
import { formatCompactCount, formatElapsed } from "../../components/admin/labels";
import { Button, SuccessBanner } from "../../components/forms/controls";
import { Modal } from "../../components/ui/Modal";

const FILTERS = [
  { value: null, label: "All" },
  { value: "pending_approval", label: "Awaiting approval" },
  { value: "pending_instagram", label: "Awaiting Instagram" },
  { value: "pending_email_verification", label: "Unverified" },
  { value: "pending_org_profile", label: "No profile" },
  { value: "active", label: "Active" },
  { value: "denied", label: "Denied" },
  { value: "erased", label: "Erased" },
] as const;

const HEADERS = [
  "Organization",
  "Followers",
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
  const deny = useDenyOrg();
  const resendAll = useResendAllPendingInstagramConnect();
  const { viewAs, error: viewAsError, isPending: viewAsPending } = useViewAs();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const busy = deny.isPending || resendAll.isPending;
  const actionError = deny.isError;

  const onConfirmResendAll = async () => {
    setBulkError(null);
    setBulkNotice(null);
    try {
      const result = (await resendAll.mutateAsync(
        undefined,
      )) as ResendConnectAllResult;
      setConfirmOpen(false);
      if (result.targeted === 0) {
        setBulkNotice("No organizations are waiting to connect Instagram.");
        return;
      }
      const parts = [`Sent ${result.sent} of ${result.targeted}.`];
      if (result.failed) parts.push(`${result.failed} failed to send.`);
      if (result.skipped) {
        parts.push(`${result.skipped} skipped (no school email).`);
      }
      setBulkNotice(parts.join(" "));
      if (result.failed) {
        setBulkError(
          "Some Connect emails did not send. Open those orgs and use Resend connect email.",
        );
      }
    } catch (err) {
      setBulkError(
        err instanceof ApiError
          ? err.message
          : "Could not send Connect emails.",
      );
    }
  };

  const decidable = (row: AdminOrgRow) =>
    row.status === "pending_approval" && row.id !== null;

  return (
    <div>
      <PageHeading
        title="Organizations"
        subtitle="Student orgs across every onboarding state. Open a row to Approve (tester invite confirm) or Deny from the awaiting-approval filter."
        actions={
          <ActionButton
            testId="resend-connect-all"
            disabled={resendAll.isPending}
            onClick={() => {
              setBulkError(null);
              setConfirmOpen(true);
            }}
          >
            Email awaiting Instagram
          </ActionButton>
        }
      />

      {bulkNotice && (
        <div className="mb-4">
          <SuccessBanner>{bulkNotice}</SuccessBanner>
        </div>
      )}
      {bulkError && <ErrorNote>{bulkError}</ErrorNote>}
      {viewAsError && <ErrorNote>{viewAsError}</ErrorNote>}
      {actionError && (
        <ErrorNote>
          That decision did not go through. Reload and try again.
        </ErrorNote>
      )}

      {confirmOpen && (
        <Modal
          onClose={() => setConfirmOpen(false)}
          title="Email orgs awaiting Instagram"
          description="Send the Connect Instagram email to every org whose last step is connecting Instagram. This does not email orgs still verifying school email or awaiting approval."
        >
          <div className="mt-6 flex justify-end gap-2 px-6 pb-4">
            <Button
              type="button"
              variant="ghost"
              size="compact"
              data-testid="resend-connect-all-cancel"
              onClick={() => setConfirmOpen(false)}
              disabled={resendAll.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="compact"
              data-testid="resend-connect-all-confirm"
              onClick={() => void onConfirmResendAll()}
              disabled={resendAll.isPending}
            >
              {resendAll.isPending ? "Sending…" : "Send emails"}
            </Button>
          </div>
        </Modal>
      )}

      <FilterChips
        options={FILTERS}
        active={status}
        basePath="/admin/orgs"
        param="status"
      />

      <Panel>
        <QueryState
          isPending={orgs.isPending}
          isError={orgs.isError}
          label="organizations"
        />
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
                <Cell muted>
                  <span className="tabular-nums">
                    {formatCompactCount(row.followerCount)}
                  </span>
                </Cell>
                <Cell muted>{row.university ?? "—"}</Cell>
                <Cell>
                  <div className="flex flex-col items-start gap-1">
                    <StatusPill status={row.status} />
                    {row.instagramHandle &&
                      !row.instagramHandleConfirmed &&
                      row.status !== "active" && <UnconfirmedIgChip />}
                  </div>
                </Cell>
                <Cell muted>{row.eduEmail ?? "—"}</Cell>
                <Cell muted>{formatElapsed(row.createdAt)}</Cell>
                <Cell align="right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {decidable(row) && (
                      <ActionButton
                        variant="danger"
                        testId={`deny-org-${row.userId}`}
                        disabled={busy}
                        onClick={() => deny.mutate(row.id as string)}
                      >
                        Deny
                      </ActionButton>
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
