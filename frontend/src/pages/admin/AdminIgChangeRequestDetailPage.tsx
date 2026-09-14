/**
 * /admin/ig-changes/:requestId — approve rename or switch, or deny.
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAdminIgChangeRequest,
  useApproveIgChangeRequest,
  useDenyIgChangeRequest,
} from "../../api/hooks/useAdminHooks";
import {
  ActionButton,
  ErrorNote,
  Field,
  FieldGrid,
  PageHeading,
  Panel,
  QueryState,
  StatusPill,
} from "../../components/admin/AdminPrimitives";
import { Checkbox } from "../../components/forms/controls";
import { ApiError } from "../../api/errors";
import { formatDateTime } from "../../components/admin/labels";

export default function AdminIgChangeRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const ticket = useAdminIgChangeRequest(requestId);
  const approve = useApproveIgChangeRequest();
  const deny = useDenyIgChangeRequest();
  const [testerConfirmed, setTesterConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = ticket.data;
  const pending = data?.status === "pending";
  const busy = approve.isPending || deny.isPending;

  const run = (
    fn: () => Promise<{ emailSent?: boolean | null }>,
    mailFailed: string,
  ) => {
    setError(null);
    void fn()
      .then((result) => {
        if (result.emailSent === false) {
          setError(mailFailed);
        }
      })
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : "That action did not go through.",
        );
      });
  };

  return (
    <div>
      <Link
        to="/admin/ig-changes?status=pending"
        className="mb-4 inline-block text-xs font-bold text-buzz-coral hover:underline"
      >
        &larr; All Instagram requests
      </Link>
      <QueryState
        isPending={ticket.isPending}
        isError={ticket.isError}
        label="this request"
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {data && (
        <>
          <PageHeading
            title={`${data.orgName ?? "Organization"} Instagram change`}
            subtitle={`@${data.currentHandle} → @${data.requestedHandle}`}
            actions={<StatusPill status={data.status} />}
          />
          <Panel title="Request">
            <FieldGrid>
              <Field label="Org kind hint">
                {data.kind === "rename" ? "Rename" : "Account switch"}
              </Field>
              <Field label="Decided as">{data.decidedKind ?? "—"}</Field>
              <Field label="University">{data.university ?? "—"}</Field>
              <Field label="Submitted">{formatDateTime(data.createdAt)}</Field>
            </FieldGrid>
            <p className="whitespace-pre-wrap px-4 py-4 text-sm font-medium text-buzz-ink">
              {data.reason}
            </p>
          </Panel>
          <Panel title="Risk">
            <FieldGrid>
              <Field label="Accepted seats">{data.acceptedCount ?? 0}</Field>
              <Field label="Linked posts">{data.linkedPostCount ?? 0}</Field>
              <Field label="Live drops">{data.liveDropCount ?? 0}</Field>
              <Field label="Finished drops">{data.finishedDropCount ?? 0}</Field>
            </FieldGrid>
          </Panel>
          {pending && (
            <Panel title="Decide">
              <div className="space-y-3 px-4 py-4">
                <p className="text-sm font-medium text-buzz-inkMuted">
                  Admin chooses the path. Rename tells them to log in again.
                  Switch releases the old Graph account and closes the portal
                  until they Connect.
                </p>
                <Checkbox
                  checked={testerConfirmed}
                  onChange={(e) => setTesterConfirmed(e.target.checked)}
                  data-testid="ig-change-tester-confirmed"
                  label="I added the requested handle as an Instagram Tester"
                />
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    variant="primary"
                    testId="ig-change-approve-rename"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          approve.mutateAsync({
                            requestId: data.id,
                            kind: "rename",
                          }),
                        "Approved, but the email telling them to log in with Instagram again failed to send.",
                      )
                    }
                  >
                    Approve rename
                  </ActionButton>
                  <ActionButton
                    variant="primary"
                    testId="ig-change-approve-switch"
                    disabled={busy || !testerConfirmed}
                    onClick={() =>
                      run(
                        () =>
                          approve.mutateAsync({
                            requestId: data.id,
                            kind: "account_switch",
                            testerInviteConfirmed: true,
                          }),
                        "Approved, but the Connect email failed to send. Open the org and use Resend connect email.",
                      )
                    }
                  >
                    Approve switch
                  </ActionButton>
                  <ActionButton
                    variant="danger"
                    testId="ig-change-deny"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => deny.mutateAsync(data.id),
                        "Denied, but the notification email failed to send.",
                      )
                    }
                  >
                    Deny
                  </ActionButton>
                </div>
                <Link
                  to={`/admin/orgs/${data.userId}`}
                  className="inline-block text-xs font-bold text-buzz-coral hover:underline"
                >
                  Open org profile
                </Link>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
