import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  useOrgIgChangeRequestState,
  useSubmitIgChangeRequest,
} from "../../api/hooks/useOrgHooks";
import { ApiError } from "../../api/errors";
import { Button, ErrorBanner, Notice, TextField } from "../forms/controls";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";
import { fieldLabelClass, focusRingClass } from "../../theme/controls";
import { STACK, TEXT } from "../../theme/tokens";
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
        setError(err instanceof ApiError ? err.message : "Could not submit the request.");
      });
  };

  return (
    <>
      <Card kind="panel" pad="card" className="flex flex-col gap-5">
        <h2 className={TEXT.h3}>Instagram identity</h2>
        {pending ? (
          <div className="flex flex-col gap-5" data-testid="ig-change-pending">
            <div>
              <p className="text-xs text-quiet">Handle</p>
              <p className="mt-1 text-sm text-primary">
                {atHandle(pending.currentHandle)} → {atHandle(pending.requestedHandle)}
              </p>
            </div>
            <Notice tone="accent">
              You submitted a request to change {atHandle(pending.currentHandle)} to{" "}
              {atHandle(pending.requestedHandle)}. Under review.
            </Notice>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs text-quiet">Handle</p>
              <p className="mt-1 text-sm text-primary">{atHandle(currentHandle)}</p>
            </div>
            {canRequest ? (
              <button
                type="button"
                data-testid="ig-change-open"
                onClick={() => setOpen(true)}
                className={cn(
                  "inline-flex items-center gap-2 self-start text-sm text-muted transition hover:text-primary",
                  focusRingClass,
                )}
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
          title={confirming ? "Confirm Instagram change" : "Request an Instagram change"}
          description={
            confirming
              ? "If Buzz approves this as an account switch, the Connect Instagram email goes to the school email on file. A rename does not send that email. Cancel and change school email first if a new officer should receive it."
              : "Buzz reviews whether this is a rename or a different account. A switch closes the portal until you Connect again."
          }
          size="wide"
        >
          {confirming ? (
            <div className={STACK.default}>
              <p className={fieldLabelClass}>Connect email inbox</p>
              <p
                className="text-sm font-medium text-primary"
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
              className={STACK.default}
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
                disabled={submit.isPending || !requested.trim() || !reason.trim()}
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
