/**
 * /admin/brands/:brandId — one brand account, its invite state, and its drops.
 *
 * The invite block is the reason this page exists. `usedAt` is ambiguous by
 * construction: issuing a new invite marks the previous one used, so a stamped
 * row means either "they redeemed it" or "we superseded it". Reading it next to
 * `passwordSet` is the only way to tell.
 */
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { Mail, Trash2 } from "lucide-react";
import {
  useAdminBrand,
  useApproveBrand,
  useApproveBrandIgChangeRequest,
  useDenyBrand,
  useDenyBrandIgChangeRequest,
  useEraseBrand,
  useResendBrandInvite,
  useSendBrandEmail,
  useUndenyBrand,
  useViewAs,
  INVITE_EMAIL_FAILED_COPY,
  type BrandInviteActionResult,
} from "../../api/hooks/useAdminHooks";
import {
  ActionButton,
  AdminBackLink,
  AdminTable,
  Cell,
  entityLinkClass,
  ErrorNote,
  Field,
  FieldGrid,
  HeadingIconButton,
  PageHeading,
  Panel,
  Pill,
  QueryState,
  Row,
  StatusPill,
  StagePill,
} from "../../components/admin/AdminPrimitives";
import {
  formatDate,
  formatDateTime,
} from "../../components/admin/labels";
import { ApiError } from "../../api/errors";
import { instagramProfileUrl } from "../../utils/instagramProfileUrl";
import ComposeEmailModal from "../../components/admin/ComposeEmailModal";
import { SuccessBanner } from "../../components/forms/controls";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";

const DROP_HEADERS = ["Drop", "Stage", "Applied", "Accepted", "Closes"] as const;

export default function AdminBrandDetailPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const brand = useAdminBrand(brandId);
  const approve = useApproveBrand();
  const deny = useDenyBrand();
  const undeny = useUndenyBrand();
  const resend = useResendBrandInvite();
  const sendEmail = useSendBrandEmail();
  const erase = useEraseBrand();
  const approveIg = useApproveBrandIgChangeRequest();
  const denyIg = useDenyBrandIgChangeRequest();
  const { viewAs, error: viewAsError, isPending: viewAsPending } = useViewAs();
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeNotice, setComposeNotice] = useState<string | null>(null);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseNotice, setEraseNotice] = useState<string | null>(null);
  const [igDecisionError, setIgDecisionError] = useState<string | null>(null);

  const data = brand.data;
  const busy =
    approve.isPending ||
    deny.isPending ||
    undeny.isPending ||
    resend.isPending;
  // Survives token_cleanup deleting the invite row: approved + no password is
  // enough, whether or not expiresAt is still present.
  const inviteLapsed =
    data?.status === "approved" &&
    !data.passwordSet &&
    (data.invite.expiresAt === null || data.invite.expiresAt <= Date.now());
  const erased = data?.status === "erased";
  const canErase = Boolean(data?.companyEmail) && !erased;
  const canResendInvite = data?.status === "approved" && !data.passwordSet;
  const igHandle = data?.instagramHandle?.replace(/^@/, "") ?? "";
  const igProfileUrl = instagramProfileUrl(igHandle);
  const pendingIg = data?.pendingIgChange ?? null;

  const onApprove = async () => {
    if (!data) return;
    setInviteNotice(null);
    try {
      const result = (await approve.mutateAsync(
        data.id,
      )) as BrandInviteActionResult;
      if (result.emailSent === false) {
        setInviteNotice(INVITE_EMAIL_FAILED_COPY);
      }
    } catch {
      // Hard failure banner below
    }
  };

  const onResend = async () => {
    if (!data) return;
    setInviteNotice(null);
    try {
      await resend.mutateAsync(data.id);
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_SEND_FAILED") {
        setInviteNotice(
          "Could not send the invite email. The brand is still approved — try Resend invite again.",
        );
        return;
      }
      // Generic recovery banner
    }
  };

  return (
    <div>
      <AdminBackLink to="/admin/brands">All brands</AdminBackLink>

      <QueryState
        isPending={brand.isPending}
        isError={brand.isError}
        label="this brand"
      />
      {viewAsError && <ErrorNote>{viewAsError}</ErrorNote>}
      {inviteNotice && <ErrorNote>{inviteNotice}</ErrorNote>}
      {composeNotice && (
        <div className="mb-4">
          <SuccessBanner>{composeNotice}</SuccessBanner>
        </div>
      )}
      {eraseNotice && (
        <div className="mb-4">
          <SuccessBanner>{eraseNotice}</SuccessBanner>
        </div>
      )}
      {(undeny.isError || (resend.isError && !inviteNotice)) && (
        <ErrorNote>
          That recovery action did not go through. Reload and try again.
        </ErrorNote>
      )}

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
                      onClick={() => void onApprove()}
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
                {data.status === "denied" && (
                  <ActionButton
                    variant="primary"
                    testId="undeny-brand"
                    disabled={busy}
                    onClick={() => undeny.mutate(data.id)}
                  >
                    Un-deny
                  </ActionButton>
                )}
                {canResendInvite && (
                  <ActionButton
                    variant="primary"
                    testId="resend-invite"
                    disabled={busy}
                    onClick={() => void onResend()}
                  >
                    Resend invite
                  </ActionButton>
                )}
                {!erased && (
                  <ActionButton
                    testId="view-as"
                    disabled={!data.impersonatable || viewAsPending}
                    onClick={() => void viewAs(data.userId)}
                  >
                    View as
                  </ActionButton>
                )}
                {Boolean(data.companyEmail) && !erased && (
                  <ActionButton
                    testId="write-email"
                    disabled={busy || sendEmail.isPending}
                    onClick={() => setComposeOpen(true)}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Mail size={14} aria-hidden />
                      Write email
                    </span>
                  </ActionButton>
                )}
                {canErase && (
                  <HeadingIconButton
                    testId="erase-brand"
                    aria-label="Erase brand"
                    disabled={busy || erase.isPending}
                    onClick={() => setEraseOpen(true)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </HeadingIconButton>
                )}
              </div>
            }
          />

          {eraseOpen && canErase && (
            <ConfirmDialog
              title="Erase this brand"
              description="Removes login identity and contact details. Campaign history for organizations stays. Type the company email to confirm."
              expected={data.companyEmail ?? ""}
              inputLabel="Company email"
              matches={(typed) =>
                typed.trim().toLowerCase() ===
                (data.companyEmail ?? "").trim().toLowerCase()
              }
              fallbackError="Erase failed. Reload and try again."
              destructive
              confirmLabel="Erase account"
              pendingLabel="Erasing…"
              pending={erase.isPending}
              inputTestId="erase-brand-confirm"
              cancelTestId="erase-brand-cancel"
              submitTestId="erase-brand-submit"
              onClose={() => setEraseOpen(false)}
              onConfirm={async (typed) => {
                const result = await erase.mutateAsync({
                  brandId: data.id,
                  confirm: typed,
                });
                setEraseNotice(
                  result.emailSent
                    ? `Account erased. Confirmation email sent (…@${result.emailToDomain}).`
                    : "Account erased. No confirmation email was sent — notify the requester manually if needed.",
                );
              }}
            />
          )}

          {composeOpen && data.companyEmail && (
            <ComposeEmailModal
              toEmail={data.companyEmail}
              recipientName={data.brandName}
              sending={sendEmail.isPending}
              onClose={() => setComposeOpen(false)}
              onSend={async ({ subject, body }) => {
                await sendEmail.mutateAsync({
                  brandId: data.id,
                  subject,
                  body,
                });
                setComposeNotice("Email sent.");
              }}
            />
          )}

          {erased && (
            <ErrorNote>
              This account has been erased. Identity and contact PII were
              scrubbed; campaign history for organizations stays under a tombstone
              brand name.
            </ErrorNote>
          )}

          {inviteLapsed && (
            <ErrorNote>
              This brand was approved but never set a password
              {data.invite.expiresAt === null
                ? ", and its invite row was cleaned up"
                : ", and its invite has expired"}
              . Use Resend invite to issue a fresh setup link.
            </ErrorNote>
          )}

          {data.intentMessage && (
            <Panel title="Application message">
              <p className="whitespace-pre-wrap px-4 py-4 text-sm font-medium text-primary">
                {data.intentMessage}
              </p>
            </Panel>
          )}

          {pendingIg && (
            <Panel title="Instagram handle change">
              <FieldGrid>
                <Field label="Current">
                  {pendingIg.currentHandle
                    ? `@${pendingIg.currentHandle.replace(/^@/, "")}`
                    : "—"}
                </Field>
                <Field label="Requested">
                  @{pendingIg.requestedHandle.replace(/^@/, "")}
                </Field>
                <Field label="Reason">
                  <span className="whitespace-pre-wrap">{pendingIg.reason}</span>
                </Field>
                <Field label="Submitted">{formatDateTime(pendingIg.createdAt)}</Field>
              </FieldGrid>
              {igDecisionError && <ErrorNote>{igDecisionError}</ErrorNote>}
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton
                  variant="primary"
                  testId="approve-brand-ig"
                  disabled={approveIg.isPending || denyIg.isPending}
                  onClick={() => {
                    setIgDecisionError(null);
                    void approveIg.mutateAsync(pendingIg.id).catch((err) => {
                      setIgDecisionError(
                        err instanceof ApiError
                          ? err.message
                          : "Could not approve the handle change.",
                      );
                    });
                  }}
                >
                  Approve
                </ActionButton>
                <ActionButton
                  variant="danger"
                  testId="deny-brand-ig"
                  disabled={approveIg.isPending || denyIg.isPending}
                  onClick={() => {
                    setIgDecisionError(null);
                    void denyIg.mutateAsync(pendingIg.id).catch((err) => {
                      setIgDecisionError(
                        err instanceof ApiError
                          ? err.message
                          : "Could not deny the handle change.",
                      );
                    });
                  }}
                >
                  Deny
                </ActionButton>
              </div>
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
                  <span className={inviteLapsed ? "text-buzz-danger" : undefined}>
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
                {igHandle && igProfileUrl ? (
                  <a
                    href={igProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={entityLinkClass}
                  >
                    @{igHandle}
                  </a>
                ) : (
                  <span className="text-buzz-warn">
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
                      className={entityLinkClass}
                    >
                      {drop.title}
                    </Link>
                  </Cell>
                  <Cell muted>
                    <StagePill stage={drop.stage} />
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
