/**
 * `/brand/settings` — brand name, Instagram handle-change request, sign-in.
 *
 * Email and the Instagram handle are not editable here. A handle change is a
 * ticket an admin approves; the company email is changed by BUZZ.
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { authUserFromWire } from "../../api/auth";
import { ApiError } from "../../api/errors";
import {
  useBrandIgChangeRequestState,
  useBrandProfile,
  useChangeBrandPassword,
  useSubmitBrandIgChangeRequest,
  useUpdateBrandProfile,
} from "../../api/hooks/useBrandHooks";
import { userFacingApiError } from "../../api/userFacingError";
import { useAuth } from "../../contexts/AuthContext";
import {
  Button,
  ErrorBanner,
  Notice,
  SuccessBanner,
  TextArea,
  TextField,
} from "../../components/forms/controls";
import { siteIdentity } from "../../data/siteIdentity";
import PageShell from "../../components/site/PageShell";
import { Card, CardHeader } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { Modal, ModalActions } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { quietLinkClass } from "../../components/ui/navItem";
import { GAP, STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

function atHandle(raw: string | null | undefined): string {
  const handle = (raw ?? "").replace(/^@/, "").trim();
  return handle ? `@${handle}` : "—";
}

/** Pen KV: a quiet label over a read-only value, with an optional action beside it. */
function ReadOnlyRow({
  label,
  value,
  action,
}: {
  label: string;
  value: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <p className="text-xs text-quiet">{label}</p>
        <p className={cn(TEXT.body, "mt-1 break-words text-primary")}>
          {value}
        </p>
      </div>
      {action}
    </div>
  );
}

export default function BrandSettingsPage() {
  const { user, acceptSession } = useAuth();
  const profile = useBrandProfile();
  const igState = useBrandIgChangeRequestState();
  const updateProfile = useUpdateBrandProfile();
  const submitIg = useSubmitBrandIgChangeRequest();
  const changePassword = useChangeBrandPassword();

  const [brandName, setBrandName] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [igOpen, setIgOpen] = useState(false);
  const [requestedHandle, setRequestedHandle] = useState("");
  const [reason, setReason] = useState("");
  const [igError, setIgError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  const shownName = brandName ?? profile.data?.brandName ?? "";
  const pending = igState.data?.pending ?? null;
  const viewingAs = Boolean(user?.impersonatedBy);
  const nameMapped = updateProfile.isError
    ? userFacingApiError(updateProfile.error, "Could not save the brand name.")
    : null;
  const passwordMapped = changePassword.isError
    ? userFacingApiError(changePassword.error, "Could not change the password.")
    : null;

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    const nextName = shownName.trim();
    if (updateProfile.isPending || !nextName) return;
    setNameSaved(false);
    void updateProfile
      .mutateAsync({ brandName: nextName })
      .then((next) => {
        setBrandName(next?.brandName ?? nextName);
        setNameSaved(true);
      })
      .catch(() => undefined);
  };

  const closeIg = () => {
    setIgOpen(false);
    setRequestedHandle("");
    setReason("");
    setIgError(null);
  };

  const submitHandleChange = (event: FormEvent) => {
    event.preventDefault();
    if (
      submitIg.isPending ||
      !requestedHandle.trim() ||
      reason.trim().length < 10
    ) {
      return;
    }
    setIgError(null);
    void submitIg
      .mutateAsync({
        requestedHandle: requestedHandle.trim(),
        reason: reason.trim(),
      })
      .then(() => closeIg())
      .catch((err) => {
        const mapped = userFacingApiError(err, "Could not submit the request.");
        setIgError(
          mapped.fields.requestedHandle ??
            mapped.fields.reason ??
            mapped.banner ??
            (err instanceof ApiError
              ? err.message
              : "Could not submit the request."),
        );
      });
  };

  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    if (
      viewingAs ||
      changePassword.isPending ||
      !currentPassword ||
      newPassword.length < 8
    ) {
      return;
    }
    setPasswordSaved(false);
    void changePassword
      .mutateAsync({ currentPassword, newPassword })
      .then((result) => {
        if (!result?.access_token || !result.user) {
          throw new Error("Password changed, but the new session was missing.");
        }
        acceptSession(authUserFromWire(result.user), result.access_token);
        setCurrentPassword("");
        setNewPassword("");
        setPasswordSaved(true);
      })
      .catch(() => undefined);
  };

  return (
    <PageShell width="form">
      <PageHeader
        kicker="Brand Portal"
        title="Setup"
        description="Your brand details and how you sign in."
      />

      {profile.isError ? (
        <div className="mb-6">
          <ErrorBanner>Could not load brand settings.</ErrorBanner>
        </div>
      ) : null}

      <div className={STACK.group}>
        <Card kind="panel" pad="card" className="flex flex-col gap-5">
          <CardHeader
            title="Brand"
            description="Your brand name shows on drops, public drop pages and emails."
            className="mb-0"
          />
          <form className={STACK.default} onSubmit={saveName}>
            <TextField
              id="brand-name"
              label="Brand name"
              name="brandName"
              value={shownName}
              onChange={(event) => {
                setBrandName(event.target.value);
                setNameSaved(false);
              }}
              data-testid="brand-name"
              error={nameMapped?.fields.brandName}
            />
            <ReadOnlyRow
              label="Instagram handle"
              value={
                <span>
                  <span data-testid="brand-ig-handle">
                    {atHandle(profile.data?.instagramHandle)}
                  </span>
                  {pending ? ` → ${atHandle(pending.requestedHandle)}` : null}
                </span>
              }
              action={
                pending ? (
                  <span data-testid="brand-ig-pending">
                    <Chip dot tone="pending">
                      Pending admin approval
                    </Chip>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIgOpen(true)}
                    data-testid="brand-ig-change-open"
                    className={quietLinkClass}
                  >
                    Request change
                    <ArrowRight size={14} aria-hidden />
                  </button>
                )
              }
            />
            {pending ? (
              <Notice tone="accent">
                You asked to change {atHandle(pending.currentHandle)} to{" "}
                {atHandle(pending.requestedHandle)}. BUZZ keeps using{" "}
                {atHandle(pending.currentHandle)} until an admin approves it.
              </Notice>
            ) : null}
            {nameMapped?.banner ? (
              <ErrorBanner>{nameMapped.banner}</ErrorBanner>
            ) : null}
            {nameSaved ? (
              <SuccessBanner>
                <span data-testid="brand-name-saved">Brand name saved.</span>
              </SuccessBanner>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateProfile.isPending || !shownName.trim()}
                data-testid="brand-name-save"
              >
                {updateProfile.isPending ? "Saving…" : "Save brand name"}
              </Button>
            </div>
          </form>
        </Card>

        <Card kind="panel" pad="card" className="flex flex-col gap-5">
          <CardHeader title="Sign-in" className="mb-0" />
          <ReadOnlyRow
            label="Company email"
            value={
              <span data-testid="brand-email">
                {profile.data?.companyEmail ?? "—"}
              </span>
            }
            action={
              <a
                href={`mailto:${siteIdentity.contact.email}`}
                className={quietLinkClass}
                data-testid="brand-email-locked"
              >
                Contact BUZZ to change
                <ArrowRight size={14} aria-hidden />
              </a>
            }
          />

          <form
            className={cn("border-t border-line pt-5", STACK.default)}
            onSubmit={savePassword}
          >
            <h4 className={cn(TEXT.body, "font-medium text-primary")}>
              Change password
            </h4>
            <div className={cn("grid grid-cols-1 sm:grid-cols-2", GAP.default)}>
              <TextField
                id="brand-current-password"
                label="Current password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                placeholder="Your current password"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  setPasswordSaved(false);
                }}
                disabled={viewingAs}
                data-testid="brand-current-password"
                error={passwordMapped?.fields.currentPassword}
              />
              <TextField
                id="brand-new-password"
                label="New password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                hint="At least 8 characters. Signs you out on your other devices."
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setPasswordSaved(false);
                }}
                disabled={viewingAs}
                data-testid="brand-new-password"
                error={passwordMapped?.fields.newPassword}
              />
            </div>
            {viewingAs ? (
              <p className={cn(TEXT.body, "text-quiet")}>
                Password changes are unavailable while viewing as this brand.
              </p>
            ) : null}
            {passwordMapped?.banner ? (
              <ErrorBanner>{passwordMapped.banner}</ErrorBanner>
            ) : null}
            {passwordSaved ? (
              <SuccessBanner>
                <span data-testid="brand-password-saved">
                  Password updated.
                </span>
              </SuccessBanner>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  viewingAs ||
                  changePassword.isPending ||
                  !currentPassword ||
                  newPassword.length < 8
                }
                data-testid="brand-password-save"
              >
                {changePassword.isPending ? "Saving…" : "Change password"}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {igOpen ? (
        <Modal
          onClose={closeIg}
          title="Request an Instagram handle change"
          description={`BUZZ approves handle changes before they take effect. ${atHandle(
            profile.data?.instagramHandle,
          )} stays in use until then.`}
        >
          <form className="flex flex-col gap-6" onSubmit={submitHandleChange}>
            <div className="flex flex-col gap-4">
              {igError ? <ErrorBanner>{igError}</ErrorBanner> : null}
              <ReadOnlyRow
                label="Current handle"
                value={atHandle(profile.data?.instagramHandle)}
              />
              <TextField
                id="brand-ig-requested"
                label="New handle"
                name="requestedHandle"
                value={requestedHandle}
                onChange={(event) => setRequestedHandle(event.target.value)}
                autoComplete="off"
                placeholder="e.g. @yourbrand_new"
                data-testid="brand-ig-requested"
              />
              <TextArea
                id="brand-ig-reason"
                label="Why"
                name="reason"
                rows={3}
                placeholder="e.g. We moved our US account to a new handle"
                hint="At least 10 characters."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                data-testid="brand-ig-reason"
              />
            </div>
            <ModalActions onCancel={closeIg}>
              <Button
                type="submit"
                disabled={
                  submitIg.isPending ||
                  !requestedHandle.trim() ||
                  reason.trim().length < 10
                }
                data-testid="brand-ig-submit"
              >
                {submitIg.isPending ? "Submitting…" : "Submit request"}
              </Button>
            </ModalActions>
          </form>
        </Modal>
      ) : null}
    </PageShell>
  );
}
