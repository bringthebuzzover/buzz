import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  useOrgIgChangeRequestState,
  useSubmitIgChangeRequest,
} from "../../api/hooks/useOrgHooks";
import { ApiError } from "../../api/errors";
import { Button, ErrorBanner, Notice, TextArea, TextField } from "../forms/controls";
import { Card } from "../ui/Card";
import { Modal, ModalActions } from "../ui/Modal";
import { fieldLabelClass } from "../../theme/controls";
import { quietLinkClass } from "../ui/navItem";
import { TEXT } from "../../theme/tokens";
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
                className={cn(quietLinkClass, "self-start")}
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
              ? "If BUZZ approves this as an account switch, the Connect Instagram email goes to the school email on file. A rename does not send that email. Cancel and change school email first if a new officer should receive it."
              : "BUZZ reviews whether this is a rename or a different account. A switch closes the portal until you Connect again."
          }
        >
          {confirming ? (
            <>
              <div className="flex flex-col gap-1">
                <p className={fieldLabelClass}>Connect email inbox</p>
                <p
                  className="text-sm text-primary"
                  data-testid="ig-change-connect-email"
                >
                  {connectEmail}
                </p>
              </div>
              <ModalActions
                onCancel={() => setConfirming(false)}
                cancelDisabled={submit.isPending}
                cancelTestId="ig-change-confirm-cancel"
              >
                <Button
                  type="button"
                  data-testid="ig-change-confirm"
                  onClick={sendRequest}
                  loading={submit.isPending}
                  loadingLabel="Sending…"
                >
                  Confirm
                </Button>
              </ModalActions>
            </>
          ) : (
            <form
              className="flex flex-col gap-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (submit.isPending || !requested.trim() || !reason.trim()) {
                  return;
                }
                setError(null);
                setConfirming(true);
              }}
            >
              <div className="flex flex-col gap-4">
                {error ? <ErrorBanner>{error}</ErrorBanner> : null}
                <TextField
                  id="ig-change-requested"
                  label="Requested handle"
                  data-testid="ig-change-requested"
                  value={requested}
                  onChange={(e) => setRequested(e.target.value)}
                />
                <TextArea
                  id="ig-change-reason"
                  label="Why"
                  rows={4}
                  data-testid="ig-change-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <ModalActions onCancel={close}>
                <Button
                  type="submit"
                  data-testid="ig-change-submit"
                  disabled={submit.isPending || !requested.trim() || !reason.trim()}
                >
                  Submit request
                </Button>
              </ModalActions>
            </form>
          )}
        </Modal>
      ) : null}
    </>
  );
}
