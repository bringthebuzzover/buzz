import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAdminShippingChangeRequest,
  useApproveShippingChangeRequest,
  useDenyShippingChangeRequest,
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
import { formatDateTime } from "../../components/admin/labels";
import { formatShippingAddress } from "../../utils/shippingAddress";
import { ApiError } from "../../api/errors";

export default function AdminShippingChangeRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const request = useAdminShippingChangeRequest(requestId);
  const approve = useApproveShippingChangeRequest();
  const deny = useDenyShippingChangeRequest();
  const [error, setError] = useState<string | null>(null);
  const data = request.data;
  const activeDropTitles = data?.activeDropTitles ?? [];
  const pending = data?.status === "pending";
  const busy = approve.isPending || deny.isPending;

  const decide = (action: () => Promise<unknown>) => {
    setError(null);
    void action().catch((err) => {
      setError(err instanceof ApiError ? err.message : "That action did not go through.");
    });
  };

  return (
    <div>
      <AdminBackLink to="/admin/changes?status=pending&account=organization&change=address">
        All changes
      </AdminBackLink>
      <QueryState isPending={request.isPending} isError={request.isError} label="this request" />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {data ? (
        <>
          <PageHeading
            title={`${data.orgName ?? "Organization"} shipping address`}
            subtitle={`${data.university ?? "University unavailable"} · ${data.eduEmail ?? "Email unavailable"}`}
            actions={<StatusPill status={data.status} />}
          />
          <Panel title="Address change">
            <FieldGrid>
              <Field label="Current address">{formatShippingAddress(data.currentAddress)}</Field>
              <Field label="Requested address">{formatShippingAddress(data.requestedAddress)}</Field>
              <Field label="Submitted">{formatDateTime(data.createdAt)}</Field>
              <Field label="Reason">{data.reason ?? "—"}</Field>
              <Field label="Active drops">
                {activeDropTitles.length ? activeDropTitles.join(", ") : "No active drops"}
              </Field>
              {data.decisionReason ? <Field label="Decision note">{data.decisionReason}</Field> : null}
            </FieldGrid>
          </Panel>
          {pending ? (
            <Panel title="Decide">
              <div className="space-y-3 px-4 py-4">
                <p className="text-sm text-muted">
                  Approval updates the address used for future shipments. Existing shipment destinations remain in their shipment history.
                </p>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    variant="primary"
                    disabled={busy}
                    onClick={() => decide(() => approve.mutateAsync(data.id))}
                  >
                    {approve.isPending ? "Approving…" : "Approve address"}
                  </ActionButton>
                  <ActionButton
                    disabled={busy}
                    onClick={() => decide(() => deny.mutateAsync({ requestId: data.id }))}
                  >
                    {deny.isPending ? "Denying…" : "Deny request"}
                  </ActionButton>
                </div>
                <Link to={`/admin/orgs/${data.requesterUserId}`} className="inline-block text-xs text-accent hover:underline">
                  Open organization profile
                </Link>
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
