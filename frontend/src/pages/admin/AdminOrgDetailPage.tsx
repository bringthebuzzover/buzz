/**
 * /admin/orgs/:userId — one student-org account.
 *
 * Beyond the profile fields, this surfaces the two things that explain a stuck
 * org: the email-verification token state, and the Instagram token expiry. An
 * expired Instagram token is worth calling out loudly because it rejects every
 * authenticated request, including the one that would let the user resend their
 * own verification email.
 *
 * Erase (PRODUCT §3.1.2) is confirm-by-IG-handle; confirmation email is
 * best-effort after wipe.
 *
 * Approve requires tester-invite confirmation (LAUNCH.md Phase A) and moves the
 * org to pending_instagram until they Connect.
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Mail, Trash2 } from "lucide-react";
import {
  useAdminOrg,
  useAckIgBindMismatch,
  useApproveOrg,
  useClearOrgInstagramToken,
  useDenyOrg,
  useEraseOrg,
  useResendOrgConnect,
  useSendOrgEmail,
  useUndenyOrg,
  useViewAs,
} from "../../api/hooks/useAdminHooks";
import { ApiError } from "../../api/client";
import { instagramProfileUrl } from "../../utils/instagramProfileUrl";
import {
  ActionButton,
  ErrorNote,
  Field,
  FieldGrid,
  HeadingIconButton,
  PageHeading,
  Panel,
  Pill,
  QueryState,
  StatusPill,
  UnconfirmedIgChip,
  IgBindMismatchChip,
} from "../../components/admin/AdminPrimitives";
import {
  formatDate,
  formatDateTime,
  formatElapsed,
} from "../../components/admin/labels";
import { Checkbox } from "../../components/forms/Checkbox";
import { Button, SuccessBanner, TextField } from "../../components/forms/controls";
import { Modal } from "../../components/ui/Modal";
import { STACK } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import ComposeEmailModal from "../../components/admin/ComposeEmailModal";

function confirmHandleMatches(typed: string, stored: string): boolean {
  const normalize = (value: string) =>
    value.trim().replace(/^@+/, "").toLowerCase();
  const expected = normalize(stored);
  return expected !== "" && normalize(typed) === expected;
}

export default function AdminOrgDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const org = useAdminOrg(userId);
  const approve = useApproveOrg();
  const deny = useDenyOrg();
  const undeny = useUndenyOrg();
  const resendConnect = useResendOrgConnect();
  const ackMismatch = useAckIgBindMismatch();
  const clearIg = useClearOrgInstagramToken();
  const erase = useEraseOrg();
  const sendEmail = useSendOrgEmail();
  const { viewAs, error: viewAsError, isPending: viewAsPending } = useViewAs();
  const [eraseNotice, setEraseNotice] = useState<string | null>(null);
  const [eraseError, setEraseError] = useState<string | null>(null);
  const [eraseConfirmOpen, setEraseConfirmOpen] = useState(false);
  const [eraseTyped, setEraseTyped] = useState("");
  const [testerInviteConfirmed, setTesterInviteConfirmed] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const data = org.data;
  const erased = data?.status === "erased";
  const busy =
    approve.isPending ||
    deny.isPending ||
    undeny.isPending ||
    clearIg.isPending ||
    erase.isPending ||
    resendConnect.isPending ||
    ackMismatch.isPending;
  const canWriteEmail = Boolean(data?.eduEmail) && !erased;
  const tokenExpired =
    data?.instagramTokenExpiresAt !== null &&
    data?.instagramTokenExpiresAt !== undefined &&
    data.instagramTokenExpiresAt <= Date.now();
  const hasIgToken =
    data?.instagramTokenExpiresAt !== null &&
    data?.instagramTokenExpiresAt !== undefined;
  const canErase = Boolean(data?.instagramHandle) && !erased;
  const liveHandle =
    data?.instagramUsername?.replace(/^@/, "") ||
    data?.instagramHandle?.replace(/^@/, "") ||
    null;
  const claimedBare = data?.claimedInstagramUsername?.replace(/^@/, "") || null;
  const graphAtMismatch = data?.igBindGraphUsername?.replace(/^@/, "") || null;
  const claimedHandle = claimedBare
    ? `@${claimedBare}`
    : liveHandle
      ? `@${liveHandle}`
      : null;
  const connectedHandle = liveHandle ? `@${liveHandle}` : null;
  const mismatchConnected = graphAtMismatch
    ? `@${graphAtMismatch}`
    : connectedHandle;
  const igProfileUrl = instagramProfileUrl(liveHandle ?? claimedBare);
  const mismatchOpen = Boolean(
    data?.igBindMismatchedAt && !data.igBindMismatchAckedAt,
  );
  const liveRenamedSinceMismatch = Boolean(
    mismatchOpen &&
      graphAtMismatch &&
      liveHandle &&
      graphAtMismatch.toLowerCase() !== liveHandle.toLowerCase(),
  );

  async function onApprove() {
    if (!data?.orgId) return;
    setActionError(null);
    setActionNotice(null);
    try {
      await approve.mutateAsync({
        orgId: data.orgId,
        testerInviteConfirmed,
      });
      setTesterInviteConfirmed(false);
      setActionNotice("Approved — org moved to awaiting Instagram connect.");
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Approve failed. Confirm the tester invite checkbox and try again.",
      );
    }
  }

  async function onResendConnect() {
    if (!data?.orgId) return;
    setActionError(null);
    setActionNotice(null);
    try {
      await resendConnect.mutateAsync(data.orgId);
      setActionNotice("Connect Instagram email re-sent.");
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Could not resend the connect email.",
      );
    }
  }

  async function onAckMismatch() {
    if (!data?.orgId) return;
    setActionError(null);
    setActionNotice(null);
    try {
      await ackMismatch.mutateAsync(data.orgId);
      setActionNotice("Instagram bind mismatch acknowledged.");
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Could not acknowledge the Instagram bind mismatch.",
      );
    }
  }

  function openEraseConfirm() {
    setEraseError(null);
    setEraseNotice(null);
    setEraseTyped("");
    setEraseConfirmOpen(true);
  }

  function cancelEraseConfirm() {
    setEraseConfirmOpen(false);
    setEraseTyped("");
    setEraseError(null);
  }

  async function onErase() {
    if (!data?.instagramHandle) return;
    setEraseError(null);
    setEraseNotice(null);
    try {
      const result = await erase.mutateAsync({
        userId: data.userId,
        confirm: eraseTyped,
      });
      setEraseConfirmOpen(false);
      setEraseTyped("");
      if (result.emailSent) {
        setEraseNotice(
          result.emailToDomain
            ? `Account erased. Confirmation email sent (…@${result.emailToDomain}).`
            : "Account erased. Confirmation email sent.",
        );
      } else {
        setEraseNotice(
          "Account erased. No confirmation email was sent — notify the requester manually if needed.",
        );
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setEraseError(err.message);
      } else {
        setEraseError("Erase failed. Reload and try again.");
      }
    }
  }

  return (
    <div>
      <Link
        to="/admin/orgs"
        className="mb-4 inline-block text-xs font-bold text-buzz-coral hover:underline"
      >
        &larr; All organizations
      </Link>

      <QueryState
        isPending={org.isPending}
        isError={org.isError}
        label="this organization"
      />
      {viewAsError && <ErrorNote>{viewAsError}</ErrorNote>}
      {(undeny.isError || clearIg.isError) && (
        <ErrorNote>
          That recovery action did not go through. Reload and try again.
        </ErrorNote>
      )}
      {eraseNotice && (
        <div className="mb-4">
          <SuccessBanner>{eraseNotice}</SuccessBanner>
        </div>
      )}
      {actionError && <ErrorNote>{actionError}</ErrorNote>}
      {actionNotice && (
        <div className="mb-4">
          <SuccessBanner>{actionNotice}</SuccessBanner>
        </div>
      )}

      {data && (
        <>
          <PageHeading
            title={data.orgName ?? "Profile not submitted"}
            subtitle={data.university ?? undefined}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={data.status} />
                {!erased && data.status === "pending_approval" && data.orgId && (
                  <>
                    <ActionButton
                      variant="primary"
                      testId="approve-org"
                      disabled={busy || !testerInviteConfirmed}
                      onClick={() => void onApprove()}
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      testId="deny-org"
                      disabled={busy}
                      onClick={() => deny.mutate(data.orgId as string)}
                    >
                      Deny
                    </ActionButton>
                  </>
                )}
                {!erased && data.status === "pending_instagram" && data.orgId && (
                  <ActionButton
                    testId="resend-connect"
                    disabled={busy}
                    onClick={() => void onResendConnect()}
                  >
                    Resend connect email
                  </ActionButton>
                )}
                {!erased && data.status === "denied" && data.orgId && (
                  <ActionButton
                    variant="primary"
                    testId="undeny-org"
                    disabled={busy}
                    onClick={() => undeny.mutate(data.orgId as string)}
                  >
                    Un-deny
                  </ActionButton>
                )}
                {!erased && (tokenExpired || hasIgToken) && (
                  <ActionButton
                    testId="clear-ig-token"
                    disabled={busy}
                    onClick={() => clearIg.mutate(data.userId)}
                  >
                    Clear IG token
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
                {canWriteEmail && (
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
                    testId="erase-org"
                    aria-label="Erase organization"
                    disabled={busy}
                    onClick={openEraseConfirm}
                  >
                    <Trash2 size={16} aria-hidden />
                  </HeadingIconButton>
                )}
              </div>
            }
          />

          {eraseConfirmOpen && canErase && connectedHandle && (
            <Modal
              onClose={cancelEraseConfirm}
              title="Erase this organization"
              description="Removes login identity and contact details. Campaign KPIs stay. Type the Instagram handle to confirm."
            >
              <div className={cn(STACK.tight, "px-6 pb-6 pt-4")}>
                {eraseError && <ErrorNote>{eraseError}</ErrorNote>}
                <TextField
                  id="erase-org-confirm"
                  data-testid="erase-org-confirm"
                  label={`Type ${connectedHandle} exactly`}
                  size="compact"
                  value={eraseTyped}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setEraseTyped(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="compact"
                    data-testid="erase-org-cancel"
                    disabled={erase.isPending}
                    onClick={cancelEraseConfirm}
                  >
                    Cancel
                  </Button>
                  <ActionButton
                    variant="danger"
                    testId="erase-org-submit"
                    disabled={
                      busy ||
                      !confirmHandleMatches(eraseTyped, data.instagramHandle ?? "")
                    }
                    onClick={() => void onErase()}
                  >
                    {erase.isPending ? "Erasing…" : "Erase account"}
                  </ActionButton>
                </div>
              </div>
            </Modal>
          )}

          {composeOpen && canWriteEmail && data.eduEmail && (
            <ComposeEmailModal
              toEmail={data.eduEmail}
              recipientName={data.orgName ?? "there"}
              sending={sendEmail.isPending}
              onClose={() => setComposeOpen(false)}
              onSend={async ({ subject, body }) => {
                await sendEmail.mutateAsync({
                  userId: data.userId,
                  subject,
                  body,
                });
                setActionNotice("Email sent.");
              }}
            />
          )}

          {data.pendingIgChangeRequestId && !erased && (
            <ErrorNote>
              Pending Instagram identity request.{" "}
              <Link
                to={`/admin/ig-changes/${data.pendingIgChangeRequestId}`}
                className="font-bold text-buzz-coral hover:underline"
              >
                Review
              </Link>
            </ErrorNote>
          )}

          {erased && (
            <ErrorNote>
              This account has been erased. Identity and contact PII were
              scrubbed; campaign KPI contribution is retained for brand
              reporting.
            </ErrorNote>
          )}

          {tokenExpired && !erased && (
            <ErrorNote>
              This org&apos;s Instagram token expired{" "}
              {formatElapsed(data.instagramTokenExpiresAt)} ago. Portal API
              requests return <code>INSTAGRAM_TOKEN_EXPIRED</code>; nightly
              refresh will not retry an already-expired token. The org
              reconnects via Instagram OAuth (
              <code>/reconnect-instagram</code>). Clear IG token is optional ops
              assist (null ciphertext + revoke sessions).
            </ErrorNote>
          )}

          {!erased && data.status === "pending_approval" && claimedHandle && (
            <Panel title="Before you approve">
              <div className="px-4 py-4">
                <Checkbox
                  checked={testerInviteConfirmed}
                  onChange={(e) => setTesterInviteConfirmed(e.target.checked)}
                  data-testid="tester-invite-confirmed"
                  label={
                    <>
                      I added {claimedHandle} as an Instagram Tester in Meta App
                      roles.
                    </>
                  }
                />
              </div>
            </Panel>
          )}

          {!erased && mismatchOpen && (
            <Panel title="Instagram bind mismatch">
              <div className="space-y-3 px-4 py-4">
                <p className="text-sm font-medium text-buzz-inkMuted">
                  This organization connected{" "}
                  {mismatchConnected ?? "a different @"} after applying as{" "}
                  {claimedHandle ?? "another handle"}
                  {liveRenamedSinceMismatch
                    ? `. Live handle is now ${connectedHandle}.`
                    : "."}{" "}
                  Portal access is already open. Ack once you have looked.
                </p>
                <ActionButton
                  testId="ack-ig-bind-mismatch"
                  disabled={busy}
                  onClick={() => void onAckMismatch()}
                >
                  Ack mismatch
                </ActionButton>
              </div>
            </Panel>
          )}

          <Panel title="Profile">
            <FieldGrid>
              <Field label="Claimed handle">
                {claimedBare ? (
                  <span className="inline-flex flex-wrap items-center gap-2 font-semibold text-buzz-ink">
                    @{claimedBare}
                    {mismatchOpen && <IgBindMismatchChip />}
                    {!data.instagramHandleConfirmed &&
                      data.status !== "active" && <UnconfirmedIgChip />}
                  </span>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Connected Instagram">
                {connectedHandle && igProfileUrl ? (
                  <a
                    href={igProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-buzz-ink hover:text-buzz-coral hover:underline"
                  >
                    {connectedHandle}
                  </a>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="TikTok">{data.tiktokHandle ?? "—"}</Field>
              <Field label="Category">{data.category ?? "—"}</Field>
              <Field label="Followers">
                {data.followerCount?.toLocaleString() ?? "—"}
              </Field>
              <Field label="Members">
                {data.memberCount?.toLocaleString() ?? "—"}
              </Field>
              <Field label="Location">
                {[data.city, data.state].filter(Boolean).join(", ") || "—"}
              </Field>
              <Field label="Contact">{data.contactName ?? "—"}</Field>
              <Field label="Delivery address">
                {erased ? (
                  <span className="text-buzz-inkMuted">
                    Shipping details removed
                  </span>
                ) : (
                  data.deliveryAddress ?? (
                    <span className="text-buzz-warn">
                      Not set — nowhere to ship product
                    </span>
                  )
                )}
              </Field>
            </FieldGrid>
          </Panel>

          <Panel
            title="Account"
            description="Login identity (.edu email and Instagram) lives on the user row."
          >
            <FieldGrid>
              <Field label="Email">{data.eduEmail ?? "—"}</Field>
              <Field label="Email verified">
                {data.emailVerifiedAt ? (
                  formatDate(data.emailVerifiedAt)
                ) : (
                  <Pill tone="warn">Not verified</Pill>
                )}
              </Field>
              <Field label="Approved">{formatDate(data.approvedAt)}</Field>
              <Field label="Signed up">{formatDate(data.createdAt)}</Field>
              <Field label="Last login">
                {formatDateTime(data.lastLoginAt)}
              </Field>
              <Field label="Live verification links">
                {data.verification.liveTokenCount}
                {data.verification.liveTokenCount === 0 &&
                  data.status === "pending_email_verification" && (
                    <span className="ml-2 text-xs font-medium text-buzz-warn">
                      none valid — they must request a new one
                    </span>
                  )}
              </Field>
              <Field label="Instagram token expires">
                {data.instagramTokenExpiresAt ? (
                  <span className={tokenExpired ? "text-buzz-danger" : undefined}>
                    {formatDate(data.instagramTokenExpiresAt)}
                  </span>
                ) : (
                  <Pill tone="warn">No token</Pill>
                )}
              </Field>
              <Field label="Token last refreshed">
                {formatDateTime(data.instagramTokenRefreshedAt)}
              </Field>
            </FieldGrid>
          </Panel>

          <Panel title="Activity">
            <FieldGrid>
              <Field label="Applied">{data.applications.applied}</Field>
              <Field label="Accepted">{data.applications.accepted}</Field>
              <Field label="Denied">{data.applications.denied}</Field>
              <Field label="Posts synced">{data.postCount}</Field>
              <Field label="Posts attributed">{data.linkedPostCount}</Field>
            </FieldGrid>
          </Panel>
        </>
      )}
    </div>
  );
}
