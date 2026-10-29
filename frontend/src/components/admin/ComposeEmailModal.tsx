import { useState } from "react";
import { ApiError } from "../../api/client";
import { Button, ErrorBanner, TextArea, TextField } from "../forms/controls";
import { Modal, ModalActions } from "../ui/Modal";
import { composeDefaultBody, opsCcAddresses } from "../../utils/composeEmail";

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
      description="Sends via BUZZ. Replies go to the contact address. Ops is CC'd."
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="compose-email-to"
            data-testid="compose-email-to"
            label="To"
            value={toEmail}
            readOnly
          />
          <TextField
            id="compose-email-cc"
            data-testid="compose-email-cc"
            label="CC"
            value={cc.join(", ")}
            readOnly
          />
        </div>
        <TextField
          id="compose-email-subject"
          data-testid="compose-email-subject"
          label="Subject"
          placeholder="e.g. Your BUZZ application"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <TextArea
          id="compose-email-body"
          data-testid="compose-email-body"
          label="Body"
          rows={8}
          resizable
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <ModalActions
        onCancel={onClose}
        cancelDisabled={sending}
        cancelTestId="compose-email-cancel"
      >
        <Button
          type="button"
          data-testid="compose-email-send"
          disabled={!canSend}
          loading={sending}
          loadingLabel="Sending…"
          onClick={() => void handleSend()}
        >
          Send
        </Button>
      </ModalActions>
    </Modal>
  );
}
