import { useState } from "react";
import {
  useOrgIgChangeRequestState,
  useSubmitIgChangeRequest,
} from "../../api/hooks/useOrgHooks";
import { ApiError } from "../../api/errors";
import { Button, ErrorBanner, Select, TextField } from "../forms/controls";
import { Card } from "../ui/Card";
import { fieldLabelClass } from "../../theme/controls";

export default function IgChangeRequestPanel({
  currentHandle,
}: {
  currentHandle: string;
}) {
  const state = useOrgIgChangeRequestState();
  const submit = useSubmitIgChangeRequest();
  const [kind, setKind] = useState<"rename" | "account_switch">(
    "account_switch",
  );
  const [requested, setRequested] = useState("");
  const [current, setCurrent] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pending = state.data?.pending;
  if (pending) {
    return (
      <Card kind="inset" pad="tight">
        <p className={fieldLabelClass}>Instagram change request</p>
        <p className="mt-2 text-sm font-medium text-buzz-ink">
          Pending review: @{pending.currentHandle} → @{pending.requestedHandle}{" "}
          ({pending.kind === "rename" ? "rename" : "account switch"}).
        </p>
      </Card>
    );
  }

  return (
    <Card kind="inset" pad="tight">
      <p className={fieldLabelClass}>Request an Instagram change</p>
      <p className="mt-2 text-sm font-medium text-buzz-inkMuted">
        The handle above stays read-only. Buzz reviews rename vs connecting a
        different Business/Creator account. A switch closes the portal until
        you Connect again.
      </p>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <div className="mt-3 space-y-3">
        <Select
          id="ig-change-kind"
          label="What changed"
          size="compact"
          value={kind}
          onChange={(e) =>
            setKind(e.target.value === "rename" ? "rename" : "account_switch")
          }
        >
          <option value="account_switch">Different Instagram account</option>
          <option value="rename">Same account, new @</option>
        </Select>
        <TextField
          id="ig-change-requested"
          label="Requested handle"
          size="compact"
          data-testid="ig-change-requested"
          value={requested}
          onChange={(e) => setRequested(e.target.value)}
        />
        <TextField
          id="ig-change-current"
          label={`Type @${currentHandle} to confirm`}
          size="compact"
          data-testid="ig-change-current"
          value={current}
          autoComplete="off"
          onChange={(e) => setCurrent(e.target.value)}
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
          type="button"
          size="compact"
          data-testid="ig-change-submit"
          disabled={
            submit.isPending ||
            !requested.trim() ||
            !reason.trim() ||
            current.trim().replace(/^@/, "").toLowerCase() !==
              currentHandle.replace(/^@/, "").toLowerCase()
          }
          onClick={() => {
            setError(null);
            void submit
              .mutateAsync({
                kind,
                currentHandle: current,
                requestedHandle: requested,
                reason,
              })
              .then(() => {
                setRequested("");
                setCurrent("");
                setReason("");
              })
              .catch((err) => {
                setError(
                  err instanceof ApiError
                    ? err.message
                    : "Could not submit the request.",
                );
              });
          }}
        >
          {submit.isPending ? "Sending…" : "Submit request"}
        </Button>
      </div>
    </Card>
  );
}
