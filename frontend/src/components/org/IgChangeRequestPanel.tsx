import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  useOrgIgChangeRequestState,
  useSubmitIgChangeRequest,
} from "../../api/hooks/useOrgHooks";
import { ApiError } from "../../api/errors";
import { Button, ErrorBanner, TextField } from "../forms/controls";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";
import { fieldLabelClass } from "../../theme/controls";
import { STACK } from "../../theme/tokens";
import { cn } from "../../theme/cn";

function atHandle(raw: string): string {
  const handle = raw.replace(/^@/, "").trim();
  return handle ? `@${handle}` : "—";
}

export default function IgChangeRequestPanel({
  currentHandle,
  connectEmail,
}: {
  currentHandle: string;
  connectEmail: string;
}) {
  const state = useOrgIgChangeRequestState();
  const submit = useSubmitIgChangeRequest();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [requested, setRequested] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pending = state.data?.pending;
  const canRequest = Boolean(currentHandle) && !pending && !state.isPending;

  const close = () => {
    setOpen(false);
    setConfirming(false);
    setError(null);
    setRequested("");
    setReason("");
  };

  const sendRequest = () => {
    if (submit.isPending) return;
    setError(null);
    void submit
      .mutateAsync({
        requestedHandle: requested,
        reason,
      })
      .then(() => {
        close();
      })
      .catch((err) => {
        setConfirming(false);
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not submit the request.",
        );
      });
  };

  return (
    <>
      <Card kind="inset" pad="tight">
        <p className={fieldLabelClass}>Instagram identity</p>
        {pending ? (
          <div data-testid="ig-change-pending">
            <p className="mt-2 text-sm font-semibold text-buzz-ink">
              {atHandle(pending.currentHandle)} →{" "}
              {atHandle(pending.requestedHandle)}
            </p>
            <p className="mt-1 text-sm font-medium text-buzz-inkMuted">
              You submitted a request to change{" "}
              {atHandle(pending.currentHandle)} to{" "}
              {atHandle(pending.requestedHandle)}. Under review.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm font-semibold text-buzz-ink">
              {atHandle(currentHandle)}
            </p>
            {canRequest ? (
              <button
                type="button"
                data-testid="ig-change-open"
                onClick={() => setOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-buzz-inkMuted underline-offset-2 hover:underline"
              >
                <Pencil size={14} aria-hidden />
                Request a change
              </button>
            ) : null}
          </>
        )}
      </Card>
      {open ? (
        <Modal
          onClose={close}
          title={
            confirming
              ? "Confirm Instagram change"
              : "Request an Instagram change"
          }
          description={
            confirming
              ? "If Buzz approves this as an account switch, the Connect Instagram email goes to the school email on file. A rename does not send that email. Cancel and change school email first if a new officer should receive it."
              : "Buzz reviews whether this is a rename or a different account. A switch closes the portal until you Connect again."
          }
          size="wide"
        >
          {confirming ? (
            <div className={cn("px-6 pb-6 pt-4", STACK.default)}>
              <p className={fieldLabelClass}>Connect email inbox</p>
              <p
                className="text-sm font-semibold text-buzz-ink"
                data-testid="ig-change-connect-email"
              >
                {connectEmail}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  data-testid="ig-change-confirm-cancel"
                  onClick={() => setConfirming(false)}
                  disabled={submit.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="compact"
                  data-testid="ig-change-confirm"
                  onClick={sendRequest}
                  disabled={submit.isPending}
                >
                  {submit.isPending ? "Sending…" : "Confirm"}
                </Button>
              </div>
            </div>
          ) : (
            <form
              className={cn("px-6 pb-6 pt-4", STACK.default)}
              onSubmit={(e) => {
                e.preventDefault();
                if (submit.isPending || !requested.trim() || !reason.trim()) {
                  return;
                }
                setError(null);
                setConfirming(true);
              }}
            >
              {error ? <ErrorBanner>{error}</ErrorBanner> : null}
              <TextField
                id="ig-change-requested"
                label="Requested handle"
                size="compact"
                data-testid="ig-change-requested"
                value={requested}
                onChange={(e) => setRequested(e.target.value)}
              />
              <TextField
                id="ig-change-reason"
                label="Why"
                size="compact"
                data-testid="ig-change-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                type="submit"
                data-testid="ig-change-submit"
                disabled={
                  submit.isPending || !requested.trim() || !reason.trim()
                }
              >
                Submit request
              </Button>
            </form>
          )}
        </Modal>
      ) : null}
    </>
  );
}
