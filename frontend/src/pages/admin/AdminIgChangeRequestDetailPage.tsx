/**
 * /admin/ig-changes/:requestId — decide or retarget an Instagram change.
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAdminIgChangeRequest,
  useApproveIgChangeRequest,
  useDenyIgChangeRequest,
  useRetargetIgChangeRequest,
  type AdminIgChangeRequest,
} from "../../api/hooks/useAdminHooks";
import {
  ActionButton,
  AdminBackLink,
  ErrorNote,
  Field,
  FieldGrid,
  PageHeading,
  Panel,
  QueryState,
  StatusPill,
} from "../../components/admin/AdminPrimitives";
import { Checkbox, TextField } from "../../components/forms/controls";
import { ApiError } from "../../api/errors";
import { formatDateTime } from "../../components/admin/labels";

export default function AdminIgChangeRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const ticket = useAdminIgChangeRequest(requestId);
  const approve = useApproveIgChangeRequest();
  const deny = useDenyIgChangeRequest();
  const retarget = useRetargetIgChangeRequest();
  const [testerConfirmed, setTesterConfirmed] = useState(false);
  const [requestedHandle, setRequestedHandle] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = ticket.data;
  const pending = data?.status === "pending";
  const busy = approve.isPending || deny.isPending || retarget.isPending;

  const run = (
    fn: () => Promise<AdminIgChangeRequest>,
    mailFailed?: string,
    onSuccess?: (result: AdminIgChangeRequest) => void,
  ) => {
    setError(null);
    setResult(null);
    void fn()
      .then((result) => {
        if (result.emailQueued === false && mailFailed) {
          setError(mailFailed);
        }
        onSuccess?.(result);
      })
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : "That action did not go through.",
        );
      });
  };

  return (
    <div>
      <AdminBackLink to="/admin/changes?status=pending&account=organization&change=instagram">All changes</AdminBackLink>
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
              <Field label="Organization kind hint">
                {data.kind === "rename" ? "Rename" : "Account switch"}
              </Field>
              <Field label="Decided as">{data.decidedKind ?? "—"}</Field>
              <Field label="University">{data.university ?? "—"}</Field>
              <Field label="Submitted">{formatDateTime(data.createdAt)}</Field>
            </FieldGrid>
            <p className="mx-6 mb-6 whitespace-pre-wrap border-l-2 border-accent py-1 pl-4 text-base text-primary">
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
                <p className="text-sm font-medium text-muted">
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
                        "Approved, but the email telling them to log in with Instagram again could not be queued.",
                      )
                    }
                  >
                    Approve rename
                  </ActionButton>
                  <ActionButton
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
                        "Approved, but the Connect email could not be queued. Open the organization and use Resend connect email.",
                      )
                    }
                  >
                    Approve switch
                  </ActionButton>
                  <ActionButton
                    testId="ig-change-deny"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => deny.mutateAsync(data.id),
                        "Denied, but the notification email could not be queued.",
                      )
                    }
                  >
                    Deny
                  </ActionButton>
                </div>
                <Link
                  to={`/admin/orgs/${data.userId}`}
                  className="inline-block text-xs text-accent hover:underline"
                >
                  Open organization profile
                </Link>
              </div>
            </Panel>
          )}
          {data.status === "awaiting_connect" && (
            <Panel title="Retarget reconnect">
              <div className="space-y-3 px-4 py-4">
                <p className="text-sm font-medium text-muted">
                  Set the Instagram handle the organization should Connect.
                </p>
                <TextField
                  label="New Instagram handle"
                  data-testid="ig-change-retarget-handle"
                  value={requestedHandle}
                  onChange={(e) => setRequestedHandle(e.target.value)}
                  disabled={busy}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                />
                <ActionButton
                  variant="primary"
                  testId="ig-change-retarget"
                  disabled={busy || !requestedHandle.trim()}
                  onClick={() =>
                    run(
                      () => retarget.mutateAsync({ requestId: data.id, requestedHandle }),
                      undefined,
                      (updated) => {
                        setResult(`Reconnect target updated to @${updated.requestedHandle}.`);
                        setRequestedHandle("");
                      },
                    )
                  }
                >
                  {retarget.isPending ? "Retargeting…" : "Retarget reconnect"}
                </ActionButton>
                {result && <p role="status" className="text-sm text-primary">{result}</p>}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
