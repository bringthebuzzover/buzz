import { useState } from "react";
import { Button, TextField } from "../forms/controls";
import { Modal } from "./Modal";

/**
 * Confirm dialog. Pass `expected` for the pen's type-to-confirm pattern
 * (the submit stays disabled until the field matches). Omit it for a plain
 * confirm. Destructive confirms use the danger pill.
 */
export function ConfirmDialog({
  title,
  description,
  expected,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: string;
  /** Phrase the user must type. Compared with surrounding whitespace trimmed. */
  expected?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = expected ? typed.trim() === expected.trim() : true;

  return (
    <Modal onClose={onClose} title={title} description={description} size="narrow">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!matches || pending) return;
          onConfirm();
        }}
      >
        {expected ? (
          <TextField
            id="confirm-phrase"
            data-testid="confirm-phrase"
            label={`Type ${expected} to confirm`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            placeholder={expected}
          />
        ) : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            data-testid="confirm-submit"
            variant={destructive ? "danger" : "primary"}
            disabled={!matches || pending}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
