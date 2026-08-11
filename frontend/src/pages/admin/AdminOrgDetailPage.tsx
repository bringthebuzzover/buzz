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
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAdminOrg,
  useApproveOrg,
  useClearOrgInstagramToken,
  useDenyOrg,
  useEraseOrg,
  useUndenyOrg,
  useViewAs,
} from "../../api/hooks/useAdminHooks";
import { ApiError } from "../../api/client";
import {
  ActionButton,
  ErrorNote,
  Field,
  FieldGrid,
  PageHeading,
  Panel,
  Pill,
  QueryState,
  StatusPill,
} from "../../components/admin/AdminPrimitives";
import {
  formatDate,
  formatDateTime,
  formatElapsed,
} from "../../components/admin/labels";

export default function AdminOrgDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const org = useAdminOrg(userId);
  const approve = useApproveOrg();
  const deny = useDenyOrg();
  const undeny = useUndenyOrg();
  const clearIg = useClearOrgInstagramToken();
  const erase = useEraseOrg();
  const { viewAs, error: viewAsError, isPending: viewAsPending } = useViewAs();
  const [eraseNotice, setEraseNotice] = useState<string | null>(null);
  const [eraseError, setEraseError] = useState<string | null>(null);

  const data = org.data;
  const erased = data?.status === "erased";
  const busy =
    approve.isPending ||
    deny.isPending ||
    undeny.isPending ||
    clearIg.isPending ||
    erase.isPending;
  const tokenExpired =
    data?.instagramTokenExpiresAt !== null &&
    data?.instagramTokenExpiresAt !== undefined &&
    data.instagramTokenExpiresAt <= Date.now();
  const hasIgToken =
    data?.instagramTokenExpiresAt !== null &&
    data?.instagramTokenExpiresAt !== undefined;
  const canErase = Boolean(data?.instagramHandle) && !erased;

  async function onErase() {
    if (!data?.instagramHandle) return;
    setEraseError(null);
    setEraseNotice(null);
    const shown = `@${data.instagramHandle.replace(/^@/, "")}`;
    const typed = window.prompt(
      `Erase this organization account?\n\nType the Instagram handle exactly to confirm: ${shown}`,
      "",
    );
    if (typed === null) return;
    try {
      const result = await erase.mutateAsync({
        userId: data.userId,
        confirm: typed,
      });
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
      {eraseError && <ErrorNote>{eraseError}</ErrorNote>}
      {eraseNotice && (
        <p className="mb-4 rounded border border-buzz-lineMid bg-buzz-cream px-3 py-2 text-sm font-medium text-buzz-ink">
          {eraseNotice}
        </p>
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
                      disabled={busy}
                      onClick={() => approve.mutate(data.orgId as string)}
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
                {canErase && (
                  <ActionButton
                    variant="danger"
                    testId="erase-org"
                    disabled={busy}
                    onClick={() => void onErase()}
                  >
                    Erase
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
              </div>
            }
          />

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

          <Panel title="Profile">
            <FieldGrid>
              <Field label="Instagram">
                {data.instagramHandle
                  ? `@${data.instagramHandle.replace(/^@/, "")}`
                  : "—"}
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
                    <span className="text-amber-700">
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
                    <span className="ml-2 text-xs font-medium text-amber-700">
                      none valid — they must request a new one
                    </span>
                  )}
              </Field>
              <Field label="Instagram token expires">
                {data.instagramTokenExpiresAt ? (
                  <span className={tokenExpired ? "text-red-700" : undefined}>
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
