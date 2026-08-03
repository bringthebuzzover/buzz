/**
 * /admin/brands/:brandId — one brand account, its invite state, and its drops.
 *
 * The invite block is the reason this page exists. `usedAt` is ambiguous by
 * construction: issuing a new invite marks the previous one used, so a stamped
 * row means either "they redeemed it" or "we superseded it". Reading it next to
 * `passwordSet` is the only way to tell.
 */
import { Link, useParams } from "react-router-dom";
import {
  useAdminBrand,
  useApproveBrand,
  useDenyBrand,
  useViewAs,
} from "../../api/hooks/useAdminHooks";
import {
  ActionButton,
  AdminTable,
  Cell,
  ErrorNote,
  Field,
  FieldGrid,
  PageHeading,
  Panel,
  Pill,
  QueryState,
  Row,
  StatusPill,
} from "../../components/admin/AdminPrimitives";
import {
  STAGE_LABELS,
  formatDate,
  formatDateTime,
} from "../../components/admin/labels";

const DROP_HEADERS = ["Drop", "Stage", "Applied", "Accepted", "Closes"] as const;

export default function AdminBrandDetailPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const brand = useAdminBrand(brandId);
  const approve = useApproveBrand();
  const deny = useDenyBrand();
  const { viewAs, error: viewAsError, isPending: viewAsPending } = useViewAs();

  const data = brand.data;
  const busy = approve.isPending || deny.isPending;
  const inviteLapsed =
    data?.status === "approved" &&
    !data.passwordSet &&
    data.invite.expiresAt !== null &&
    data.invite.expiresAt <= Date.now();

  return (
    <div>
      <Link
        to="/admin/brands"
        className="mb-4 inline-block text-xs font-bold text-buzz-coral hover:underline"
      >
        &larr; All brands
      </Link>

      <QueryState
        isPending={brand.isPending}
        isError={brand.isError}
        label="this brand"
      />
      {viewAsError && <ErrorNote>{viewAsError}</ErrorNote>}

      {data && (
        <>
          <PageHeading
            title={data.brandName}
            subtitle={data.companyEmail}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={data.status} />
                {data.status === "pending_review" && (
                  <>
                    <ActionButton
                      variant="primary"
                      testId="approve-brand"
                      disabled={busy}
                      onClick={() => approve.mutate(data.id)}
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      testId="deny-brand"
                      disabled={busy}
                      onClick={() => deny.mutate(data.id)}
                    >
                      Deny
                    </ActionButton>
                  </>
                )}
                <ActionButton
                  testId="view-as"
                  disabled={!data.impersonatable || viewAsPending}
                  onClick={() => void viewAs(data.userId)}
                >
                  View as
                </ActionButton>
              </div>
            }
          />

          {inviteLapsed && (
            <ErrorNote>
              This brand was approved but never set a password, and its invite has
              expired. There is no way to re-issue one — a new invite is only
              generated when a brand moves out of pending review.
            </ErrorNote>
          )}

          {data.intentMessage && (
            <Panel title="Application message">
              <p className="whitespace-pre-wrap px-4 py-4 text-sm font-medium text-buzz-ink">
                {data.intentMessage}
              </p>
            </Panel>
          )}

          <Panel title="Access">
            <FieldGrid>
              <Field label="Brand status">
                <StatusPill status={data.status} />
              </Field>
              <Field label="User status">
                <StatusPill status={data.userStatus} />
              </Field>
              <Field label="Password set">
                {data.passwordSet ? (
                  <Pill tone="good">Yes</Pill>
                ) : (
                  <Pill tone="warn">No</Pill>
                )}
              </Field>
              <Field label="Invite issued">
                {formatDateTime(data.invite.issuedAt)}
              </Field>
              <Field label="Invite expires">
                {data.invite.expiresAt ? (
                  <span className={inviteLapsed ? "text-red-700" : undefined}>
                    {formatDateTime(data.invite.expiresAt)}
                  </span>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Invite consumed">
                {data.invite.usedAt ? formatDateTime(data.invite.usedAt) : "—"}
              </Field>
              <Field label="Instagram">
                {data.instagramHandle ? (
                  `@${data.instagramHandle.replace(/^@/, "")}`
                ) : (
                  <span className="text-amber-700">
                    Not set — auto-link can match nothing
                  </span>
                )}
              </Field>
              <Field label="Approved">{formatDate(data.approvedAt)}</Field>
              <Field label="Last login">
                {formatDateTime(data.lastLoginAt)}
              </Field>
            </FieldGrid>
          </Panel>

          <Panel title="Drops">
            <AdminTable
              headers={DROP_HEADERS}
              isEmpty={data.drops.length === 0}
              empty="This brand has not requested any drops."
            >
              {data.drops.map((drop) => (
                <Row key={drop.id}>
                  <Cell>
                    <Link
                      to={`/admin/drops/${drop.id}`}
                      className="font-semibold text-buzz-ink hover:text-buzz-coral hover:underline"
                    >
                      {drop.title}
                    </Link>
                  </Cell>
                  <Cell muted>
                    {STAGE_LABELS[drop.stage] ?? drop.stage}
                  </Cell>
                  <Cell muted>{drop.appliedCount}</Cell>
                  <Cell muted>
                    {drop.acceptedCount} / {drop.capacityTotal}
                  </Cell>
                  <Cell muted>{formatDate(drop.applyCloseAt)}</Cell>
                </Row>
              ))}
            </AdminTable>
          </Panel>
        </>
      )}
    </div>
  );
}
