/**
 * /admin/orgs/:userId — one student-org account.
 *
 * Beyond the profile fields, this surfaces the two things that explain a stuck
 * org: the email-verification token state, and the Instagram token expiry. An
 * expired Instagram token is worth calling out loudly because it rejects every
 * authenticated request, including the one that would let the user resend their
 * own verification email.
 */
import { Link, useParams } from "react-router-dom";
import {
  useAdminOrg,
  useApproveOrg,
  useClearOrgInstagramToken,
  useDenyOrg,
  useUndenyOrg,
  useViewAs,
} from "../../api/hooks/useAdminHooks";
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
  const { viewAs, error: viewAsError, isPending: viewAsPending } = useViewAs();

  const data = org.data;
  const busy =
    approve.isPending || deny.isPending || undeny.isPending || clearIg.isPending;
  const tokenExpired =
    data?.instagramTokenExpiresAt !== null &&
    data?.instagramTokenExpiresAt !== undefined &&
    data.instagramTokenExpiresAt <= Date.now();
  const hasIgToken =
    data?.instagramTokenExpiresAt !== null &&
    data?.instagramTokenExpiresAt !== undefined;

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

      {data && (
        <>
          <PageHeading
            title={data.orgName ?? "Profile not submitted"}
            subtitle={data.university ?? undefined}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={data.status} />
                {data.status === "pending_approval" && data.orgId && (
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
                {data.status === "denied" && data.orgId && (
                  <ActionButton
                    variant="primary"
                    testId="undeny-org"
                    disabled={busy}
                    onClick={() => undeny.mutate(data.orgId as string)}
                  >
                    Un-deny
                  </ActionButton>
                )}
                {(tokenExpired || hasIgToken) && (
                  <ActionButton
                    testId="clear-ig-token"
                    disabled={busy}
                    onClick={() => clearIg.mutate(data.userId)}
                  >
                    Clear IG token
                  </ActionButton>
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

          {tokenExpired && (
            <ErrorNote>
              This org's Instagram token expired {formatElapsed(data.instagramTokenExpiresAt)} ago.
              Every authenticated request they make is rejected, and the nightly
              refresh job will not retry an already-expired token. Clear the token
              so they can authenticate again and reconnect via Instagram.
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
                {data.deliveryAddress ?? (
                  <span className="text-amber-700">
                    Not set — nowhere to ship product
                  </span>
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
