/**
 * Change / pending-swap UI for a verified school .edu (PRODUCT §3.1).
 *
 * Used on the active org profile and the pending-approval wait screen.
 */
import { useState } from "react";
import { ApiError } from "../../api/client";
import {
  useCancelPendingEduEmail,
  useResendVerification,
  useRotateEduEmail,
} from "../../api/hooks/useOnboardingHooks";

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

  const busy = rotate.isPending || resend.isPending || cancel.isPending;

  const onRotate = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      const result = await rotate.mutateAsync(nextEmail.trim());
      await onChanged();
      setShowForm(false);
      setNextEmail("");
      setNotice(`Verification email sent to ${result.emailSentTo}.`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not start the email change. Please try again.",
      );
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
        err instanceof ApiError
          ? err.message
          : "Could not cancel the pending change.",
      );
    }
  };

  return (
    <div className="rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-buzz-inkMuted">
        School email
      </p>
      <p className="mt-2 text-sm font-semibold text-buzz-ink">
        {liveEmail || "No .edu email on file"}
      </p>

      {pendingEmail ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-buzz-inkMuted">
            Pending change to{" "}
            <span className="font-semibold text-buzz-ink">{pendingEmail}</span>.
            Confirm via the link we sent — your current email stays active until
            then.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onResend()}
              disabled={busy}
              className="rounded-lg border-2 border-buzz-coral px-3 py-1.5 text-sm font-bold text-buzz-coral transition enabled:hover:bg-buzz-coral enabled:hover:text-buzz-paper disabled:opacity-60"
            >
              {resend.isPending ? "Sending…" : "Resend"}
            </button>
            <button
              type="button"
              onClick={() => void onCancel()}
              disabled={busy}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-buzz-inkMuted underline-offset-2 hover:underline disabled:opacity-60"
            >
              Cancel change
            </button>
          </div>
        </div>
      ) : !showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-3 text-sm font-medium text-buzz-inkMuted underline-offset-2 hover:underline"
        >
          Change school email
        </button>
      ) : (
        <form onSubmit={(e) => void onRotate(e)} className="mt-3 space-y-3">
          <label className="block text-sm font-medium text-buzz-ink">
            New school email
            <input
              type="email"
              required
              value={nextEmail}
              onChange={(ev) => setNextEmail(ev.target.value)}
              className="mt-1 w-full rounded-lg border border-buzz-ink/15 bg-buzz-cream px-3 py-2 text-sm"
              placeholder="you@university.edu"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-buzz-coral px-4 py-2 text-sm font-bold text-buzz-paper disabled:opacity-60"
            >
              {rotate.isPending ? "Sending…" : "Send verification"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setNextEmail("");
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-buzz-inkMuted"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {notice ? (
        <p className="mt-3 rounded-lg bg-green-50 p-2 text-sm font-medium text-green-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
