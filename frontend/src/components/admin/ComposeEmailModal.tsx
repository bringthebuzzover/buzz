import { useState } from "react";
import { ApiError } from "../../api/client";
import { Button, TextArea, TextField } from "../forms/controls";
import { Modal } from "../ui/Modal";
import { STACK } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import { composeDefaultBody, opsCcAddresses } from "../../utils/composeEmail";
import { ErrorNote } from "./AdminPrimitives";

type Props = {
  toEmail: string;
  recipientName: string;
  onClose: () => void;
  onSend: (input: { subject: string; body: string }) => Promise<void>;
  sending: boolean;
};

export default function ComposeEmailModal({
  toEmail,
  recipientName,
  onClose,
  onSend,
  sending,
}: Props) {
  const cc = opsCcAddresses(toEmail);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(() => composeDefaultBody(recipientName));
  const [error, setError] = useState<string | null>(null);
  const canSend = subject.trim() !== "" && body.trim() !== "" && !sending;

  async function handleSend() {
    setError(null);
    try {
      await onSend({ subject: subject.trim(), body: body.trim() });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not send the email. Try again.",
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      title="Write email"
      description="Sends via Buzz. Replies go to the contact address. Ops is CC'd."
      size="wide"
    >
      <div className={cn(STACK.tight, "px-6 pb-6 pt-4")}>
        {error && <ErrorNote>{error}</ErrorNote>}
        <TextField
          id="compose-email-to"
          data-testid="compose-email-to"
          label="To"
          size="compact"
          value={toEmail}
          readOnly
        />
        <TextField
          id="compose-email-cc"
          data-testid="compose-email-cc"
          label="CC"
          size="compact"
          value={cc.join(", ")}
          readOnly
        />
        <TextField
          id="compose-email-subject"
          data-testid="compose-email-subject"
          label="Subject"
          size="compact"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <TextArea
          id="compose-email-body"
          data-testid="compose-email-body"
          label="Body"
          size="compact"
          rows={10}
          resizable
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="compact"
            data-testid="compose-email-cancel"
            disabled={sending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="compact"
            data-testid="compose-email-send"
            disabled={!canSend}
            onClick={() => void handleSend()}
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
