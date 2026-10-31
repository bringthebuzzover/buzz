/**
 * /admin/orgs — every student-org account, filterable by status.
 *
 * The pending-approval queue is a filter on this one table rather than its own
 * page, so the queue and the full list can never disagree about what a row looks
 * like. `?status=` drives the filter, which keeps every view shareable.
 */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  entityLinkClass,
  ErrorNote,
  FilterChips,
  PageHeading,
  QueryState,
  Row,
  StatusPill,
  UnconfirmedIgChip,
  IgBindMismatchChip,
} from "../../components/admin/AdminPrimitives";
import { formatCompactCount, formatElapsed } from "../../components/admin/labels";
import { SuccessBanner } from "../../components/forms/controls";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";

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

const ATTENTION_FILTERS = [
  { value: null, label: "Any attention" },
  { value: "ig_bind_mismatch", label: "IG bind mismatch" },
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
  const attention = searchParams.get("attention");
  const orgs = useAdminOrgs(status ?? undefined, attention ?? undefined);
  const deny = useDenyOrg();
  const resendAll = useResendAllPendingInstagramConnect();
  const { viewAs, error: viewAsError, isPending: viewAsPending } = useViewAs();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const busy = deny.isPending || resendAll.isPending;
  const actionError = deny.isError;

  const decidable = (row: AdminOrgRow) =>
    row.status === "pending_approval" && row.id !== null;

  return (
    <div>
      <PageHeading
        title="Organizations"
        subtitle="Student organizations across every onboarding state. Open a row to Approve (tester invite confirm) or Deny from the awaiting-approval filter."
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
        <ConfirmDialog
          title="Email organizations awaiting Instagram"
          description="Send the Connect Instagram email to every organization whose last step is connecting Instagram. This does not email organizations still verifying school email or awaiting approval."
          confirmLabel="Send emails"
          pendingLabel="Sending…"
          pending={resendAll.isPending}
          cancelTestId="resend-connect-all-cancel"
          submitTestId="resend-connect-all-confirm"
          fallbackError="Could not send Connect emails."
          onConfirm={async () => {
            setBulkError(null);
            setBulkNotice(null);
            const result = (await resendAll.mutateAsync(
              undefined,
            )) as ResendConnectAllResult;
            if (result.targeted === 0) {
              setBulkNotice("No organizations are waiting to connect Instagram.");
              return;
            }
            const parts = [`Queued ${result.queued} of ${result.targeted}.`];
            if (result.failed) parts.push(`${result.failed} failed to queue.`);
            if (result.skipped) {
              parts.push(`${result.skipped} skipped (no school email).`);
            }
            setBulkNotice(parts.join(" "));
            if (result.failed) {
              setBulkError(
                "Some Connect emails could not be queued. Open those organizations and use Resend connect email.",
              );
            }
          }}
          onClose={() => setConfirmOpen(false)}
        />
      )}

      <FilterChips
        options={[...FILTERS]}
        active={status}
        basePath="/admin/orgs"
        param="status"
      />
      <FilterChips
        options={[...ATTENTION_FILTERS]}
        active={attention}
        basePath="/admin/orgs"
        param="attention"
      />

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
            <Row
              key={row.userId}
              attention={
                row.status === "pending_approval" ||
                Boolean(row.igBindMismatchedAt && !row.igBindMismatchAckedAt)
              }
            >
              <Cell>
                <Link
                  to={`/admin/orgs/${row.userId}`}
                  className={`block ${entityLinkClass}`}
                >
                  {row.orgName ?? "Profile not submitted"}
                </Link>
                {row.instagramHandle && (
                  <span className="mt-0.5 block text-xs text-quiet">
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
                    {row.igBindMismatchedAt &&
                      !row.igBindMismatchAckedAt && <IgBindMismatchChip />}
                  </div>
                </Cell>
                <Cell muted>{row.eduEmail ?? "—"}</Cell>
                <Cell muted>{formatElapsed(row.createdAt)}</Cell>
                <Cell align="right">
                  <div className="flex flex-wrap justify-end gap-2 md:flex-nowrap md:gap-4 md:whitespace-nowrap">
                    {decidable(row) && (
                      <ActionButton
                        quiet
                        variant="danger"
                        testId={`deny-org-${row.userId}`}
                        disabled={busy}
                        onClick={() => deny.mutate(row.id as string)}
                      >
                        Deny
                      </ActionButton>
                    )}
                    <ActionButton
                      quiet
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
    </div>
  );
}
