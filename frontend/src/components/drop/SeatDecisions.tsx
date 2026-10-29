/**
 * Per-seat decisions, shared by the brand and BUZZ drop pages.
 *
 * A decision is a private draft until "Send decisions": then the org sees it
 * (denials are emailed) and the seat locks for the brand. Undecided applicants keep waiting
 * and can be decided in a later round.
 */
import { useState } from "react";
import { Button, ErrorBanner, Select, SuccessBanner } from "../forms/controls";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export type SeatDecision = "applied" | "accepted" | "denied";

type Seat = { decision: string; decisionSentAt?: number | null };

/** Drafted (decided, not sent) seats split by outcome. */
export function draftedCounts(seats: readonly Seat[]) {
  const drafted = seats.filter((s) => s.decision !== "applied" && s.decisionSentAt == null);
  const accepted = drafted.filter((s) => s.decision === "accepted").length;
  return { accepted, denied: drafted.length - accepted, total: drafted.length };
}

export function SeatDecisionSelect({
  id,
  orgName,
  value,
  sent = false,
  disabled,
  onChange,
}: {
  id: string;
  orgName: string;
  value: string;
  /** A sent decision only moves forward to Accept (BUZZ reversing a denial). */
  sent?: boolean;
  disabled?: boolean;
  onChange: (decision: SeatDecision) => void;
}) {
  const locked = (option: SeatDecision) => sent && option !== value && option !== "accepted";
  return (
    <Select
      id={`decision-${id}`}
      data-testid={`decision-${id}`}
      aria-label={`Decision for ${orgName}`}
      size="compact"
      className="min-w-32"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as SeatDecision)}
    >
      <option value="applied" disabled={locked("applied")}>
        Undecided
      </option>
      <option value="accepted">Accept</option>
      <option value="denied" disabled={locked("denied")}>
        Deny
      </option>
    </Select>
  );
}

export function SendDecisionsBar({
  seats,
  pending,
  error,
  onSend,
  note,
  locks = true,
}: {
  seats: readonly Seat[];
  pending: boolean;
  /** A failed decision save from the rows above. */
  error?: string | null;
  onSend: () => Promise<unknown>;
  /** Extra line under the counts (e.g. capacity). */
  note?: string;
  /** Brands can't change a sent decision; BUZZ can (forward to Accept only). */
  locks?: boolean;
}) {
  const counts = draftedCounts(seats);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function confirm() {
    setSendError(null);
    try {
      await onSend();
      setSent(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send decisions.");
    }
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={cn(TEXT.body, "text-muted")}>
          {counts.total === 0
            ? "No drafted decisions."
            : `Ready to send: accept ${counts.accepted} · deny ${counts.denied}`}
          {note ? ` · ${note}` : ""}
        </span>
        <Button
          type="button"
          data-testid="send-decisions"
          disabled={counts.total === 0 || pending}
          onClick={() => {
            setSent(false);
            setOpen(true);
          }}
        >
          Send decisions
        </Button>
      </div>
      {sent ? <SuccessBanner>Decisions sent.</SuccessBanner> : null}
      {error || sendError ? <ErrorBanner>{error ?? sendError}</ErrorBanner> : null}
      {open ? (
        <ConfirmDialog
          title="Send decisions"
          description={`Accept ${counts.accepted} · deny ${counts.denied}. Denied organizations are emailed; accepted ones see the campaign in My Campaigns${locks ? ", and sent decisions can't be changed" : ""}. Undecided applicants keep waiting.`}
          confirmLabel="Send decisions"
          pendingLabel="Sending…"
          pending={pending}
          submitTestId="send-decisions-confirm"
          onConfirm={() => void confirm()}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
