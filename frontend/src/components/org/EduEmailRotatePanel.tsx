/**
 * Change / pending-swap UI for a verified school .edu (PRODUCT §3.1).
 *
 * Used on the active org profile and the pending-approval wait screen.
 */
import { useState } from "react";
import { Pencil } from "lucide-react";
import { ApiError } from "../../api/client";
import { userFacingApiError } from "../../api/userFacingError";
import FieldError from "../forms/FieldError";
import { Button, ErrorBanner, SuccessBanner, TextField } from "../forms/controls";
import { Card } from "../ui/Card";
import { quietLinkClass } from "../ui/navItem";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import {
  useCancelPendingEduEmail,
  useResendVerification,
  useRotateEduEmail,
} from "../../api/hooks/useOnboardingHooks";
import { isFieldError, parseEduEmail } from "../../utils/formValidation";

type Props = {
  liveEmail: string | null | undefined;
  pendingEmail: string | null | undefined;
  onChanged: () => Promise<unknown> | void;
};

export default function EduEmailRotatePanel({
  liveEmail,
  pendingEmail,
  onChanged,
}: Props) {
  const rotate = useRotateEduEmail();
  const resend = useResendVerification();
  const cancel = useCancelPendingEduEmail();
  const [showForm, setShowForm] = useState(false);
  const [nextEmail, setNextEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const busy = rotate.isPending || resend.isPending || cancel.isPending;

  const onRotate = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setNotice(null);
    setError(null);
    setFieldError(null);
    const parsed = parseEduEmail(nextEmail);
    if (isFieldError(parsed)) {
      setFieldError(parsed.error);
      return;
    }
    try {
      const result = await rotate.mutateAsync(parsed);
      await onChanged();
      setShowForm(false);
      setNextEmail("");
      setNotice(`Verification email sent to ${result.emailSentTo}.`);
    } catch (err) {
      const mapped = userFacingApiError(
        err,
        "Could not start the email change. Please try again.",
      );
      setFieldError(mapped.fields.eduEmail ?? null);
      setError(mapped.banner);
    }
  };

  const onResend = async () => {
    setNotice(null);
    setError(null);
    try {
      await resend.mutateAsync();
      setNotice("Verification email re-sent. Check your inbox.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not re-send the email. Please try again later.",
      );
    }
  };

  const onCancel = async () => {
    setNotice(null);
    setError(null);
    try {
      await cancel.mutateAsync();
      await onChanged();
      setNotice("Pending school email change canceled.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not cancel the pending change.",
      );
    }
  };

  return (
    <Card kind="panel" pad="card" className="flex flex-col gap-5 text-left">
      <h2 className={TEXT.h3}>School email</h2>
      <div>
        <p className="text-xs text-quiet">Email</p>
        <p className="mt-1 break-all text-sm text-primary">
          {liveEmail || "No .edu email on file"}
        </p>
      </div>

      {pendingEmail ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Pending change to{" "}
            <span className="font-medium text-primary">{pendingEmail}</span>. Confirm via
            the link we sent — your current email stays active until then.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="compact"
              variant="outline"
              onClick={() => void onResend()}
              disabled={busy}
            >
              {resend.isPending ? "Sending…" : "Resend"}
            </Button>
            <Button
              type="button"
              size="compact"
              variant="ghost"
              onClick={() => void onCancel()}
              disabled={busy}
            >
              Cancel change
            </Button>
          </div>
        </div>
      ) : !showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className={cn(quietLinkClass, "self-start")}
        >
          <Pencil size={14} aria-hidden />
          Change school email
        </button>
      ) : (
        <form onSubmit={(e) => void onRotate(e)} className="space-y-3">
          <div>
            <TextField
              id="edu-rotate-email"
              type="email"
              required
              label="New school email"
              value={nextEmail}
              onChange={(ev) => setNextEmail(ev.target.value)}
              placeholder="you@university.edu"
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? "edu-rotate-email-error" : undefined}
            />
            <FieldError id="edu-rotate-email-error" message={fieldError ?? undefined} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="compact" disabled={busy}>
              {rotate.isPending ? "Sending…" : "Send verification"}
            </Button>
            <Button
              type="button"
              size="compact"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setNextEmail("");
              }}
            >
              Back
            </Button>
          </div>
        </form>
      )}

      {notice ? <SuccessBanner>{notice}</SuccessBanner> : null}
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
    </Card>
  );
}
