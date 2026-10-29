/**
 * `/brand/settings` — brand name, Instagram handle-change request, sign-in.
 *
 * Email and the Instagram handle are not editable here. A handle change is a
 * ticket an admin approves; the company email is changed by Buzz.
 */
import { useState, type FormEvent } from "react";
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
  SuccessBanner,
  TextArea,
  TextField,
} from "../../components/forms/controls";
import { siteIdentity } from "../../data/siteIdentity";
import PageShell from "../../components/site/PageShell";
import { Card, CardHeader } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { fieldLabelClass } from "../../theme/controls";
import { GAP, STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

function atHandle(raw: string | null | undefined): string {
  const handle = (raw ?? "").replace(/^@/, "").trim();
  return handle ? `@${handle}` : "—";
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
            (err instanceof ApiError ? err.message : "Could not submit the request."),
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
      <p className={TEXT.meta}>Brand Portal</p>
      <h1 className={cn("mt-1", TEXT.h1)}>Setup</h1>
      <p className={cn("mt-2", TEXT.meta)}>
        Brand profile and the sign-in for this account.
      </p>

      {profile.isError ? (
        <div className="mt-4">
          <ErrorBanner>Could not load brand settings.</ErrorBanner>
        </div>
      ) : null}

      <div className={cn("mt-6", STACK.default)}>
        <Card>
          <CardHeader
            title="Brand"
            description="Name shown to organizations."
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
            {nameMapped?.banner ? <ErrorBanner>{nameMapped.banner}</ErrorBanner> : null}
            {nameSaved ? (
              <SuccessBanner>
                <span data-testid="brand-name-saved">Brand name saved.</span>
              </SuccessBanner>
            ) : null}
            <Button
              type="submit"
              disabled={updateProfile.isPending || !shownName.trim()}
              data-testid="brand-name-save"
            >
              {updateProfile.isPending ? "Saving…" : "Save brand name"}
            </Button>
          </form>

          <div className="mt-6 border-t border-buzz-lineMid pt-4">
            <p className={TEXT.micro}>Instagram</p>
            <p className={cn("mt-1", TEXT.body)} data-testid="brand-ig-handle">
              {atHandle(profile.data?.instagramHandle)}
            </p>
            {pending ? (
              <p className={cn("mt-3", TEXT.body)} data-testid="brand-ig-pending">
                You asked to change {atHandle(pending.currentHandle)} to{" "}
                {atHandle(pending.requestedHandle)}. BUZZ keeps using{" "}
                {atHandle(pending.currentHandle)} until an admin approves it.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setIgOpen(true)}
                data-testid="brand-ig-change-open"
                className="mt-3 text-sm font-medium text-buzz-inkMuted underline-offset-2 hover:text-accent hover:underline"
              >
                Request change
              </button>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Sign-in"
            description="Email and password for this brand account."
          />
          <div>
            <p className={fieldLabelClass}>Email</p>
            <p className={cn("mt-1", TEXT.body)} data-testid="brand-email">
              {profile.data?.companyEmail ?? "—"}
            </p>
            <a
              href={`mailto:${siteIdentity.contact.email}`}
              className={cn("mt-2 inline-block", TEXT.meta, "underline-offset-2 hover:underline")}
              data-testid="brand-email-locked"
            >
              Contact BUZZ to change
            </a>
          </div>

          <form
            className={cn("mt-6 border-t border-buzz-lineMid pt-4", STACK.default)}
            onSubmit={savePassword}
          >
            <div className={cn("grid grid-cols-1 sm:grid-cols-2", GAP.default)}>
              <TextField
                id="brand-current-password"
                label="Current password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
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
            <p className={TEXT.meta}>Signs you out on your other devices.</p>
            {viewingAs ? (
              <p className={TEXT.meta}>
                Password changes are unavailable while viewing as this brand.
              </p>
            ) : null}
            {passwordMapped?.banner ? (
              <ErrorBanner>{passwordMapped.banner}</ErrorBanner>
            ) : null}
            {passwordSaved ? (
              <SuccessBanner>
                <span data-testid="brand-password-saved">Password updated.</span>
              </SuccessBanner>
            ) : null}
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
          </form>
        </Card>
      </div>

      {igOpen ? (
        <Modal
          onClose={closeIg}
          title="Request an Instagram handle change"
          description="Buzz reviews this before the handle on your brand profile changes."
          size="wide"
        >
          <form
            className={STACK.default}
            onSubmit={submitHandleChange}
          >
            {igError ? <ErrorBanner>{igError}</ErrorBanner> : null}
            <TextField
              id="brand-ig-requested"
              label="New handle"
              name="requestedHandle"
              value={requestedHandle}
              onChange={(event) => setRequestedHandle(event.target.value)}
              autoComplete="off"
              data-testid="brand-ig-requested"
            />
            <TextArea
              id="brand-ig-reason"
              label="Reason"
              name="reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              data-testid="brand-ig-reason"
            />
            <p className={TEXT.meta}>At least 10 characters.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeIg}>
                Cancel
              </Button>
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
            </div>
          </form>
        </Modal>
      ) : null}
    </PageShell>
  );
}
