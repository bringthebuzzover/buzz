import { useId, useState, type ReactNode } from "react";
import { ApiError } from "../../api/errors";
import { Button, ErrorBanner, TextField } from "../forms/controls";
import { Modal, ModalActions } from "./Modal";

/**
 * Confirm dialog: every confirm, erase and hide modal in the app.
 *
 * Pass `expected` for the pen's type-to-confirm pattern: the submit stays
 * disabled until the field matches (trimmed equality, or `matches` when the
 * comparison is looser, e.g. a handle with or without `@`). The typed value is
 * handed to `onConfirm` because some endpoints re-check it server-side.
 *
 * `children` sits between the field and the footer (a checkbox, a key/value
 * summary). Destructive confirms use the danger pill.
 */
export function ConfirmDialog({
  title,
  description,
  expected,
  inputLabel,
  matches,
  confirmLabel = "Confirm",
  pendingLabel,
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  error,
  fallbackError = "Could not confirm.",
  children,
  inputTestId = "confirm-phrase",
  submitTestId = "confirm-submit",
  cancelTestId,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: ReactNode;
  /** Phrase the user must type. */
  expected?: string;
  /** Field label. Defaults to `Type <expected> to confirm`. */
  inputLabel?: string;
  /** Custom comparison for `expected`. */
  matches?: (typed: string) => boolean;
  confirmLabel?: string;
  /** Label while `pending`, e.g. "Erasing…". */
  pendingLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  error?: ReactNode;
  /** Async confirms close on success; failures show the API message or this fallback. */
  fallbackError?: string;
  children?: ReactNode;
  inputTestId?: string;
  submitTestId?: string;
  cancelTestId?: string;
  onConfirm: (typed: string) => void | Promise<unknown>;
  onClose: () => void;
}) {
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const displayedError = error || confirmError;
  const ok =
    expected == null
      ? true
      : matches
        ? matches(typed)
        : typed.trim() === expected.trim();

  return (
    <Modal onClose={onClose} title={title} description={description}>
      <form
        className="flex flex-col gap-6"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!ok || pending) return;
          setConfirmError(null);
          try {
            const result = onConfirm(typed);
            if (result) {
              await result;
              onClose();
            }
          } catch (err) {
            setConfirmError(err instanceof ApiError ? err.message : fallbackError);
          }
        }}
      >
        {displayedError || expected != null || children ? (
          <div className="flex flex-col gap-4">
            {displayedError ? <ErrorBanner>{displayedError}</ErrorBanner> : null}
            {expected != null ? (
              <TextField
                id={inputId}
                data-testid={inputTestId}
                label={inputLabel ?? `Type ${expected} to confirm`}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={expected}
              />
            ) : null}
            {children}
          </div>
        ) : null}
        <ModalActions
          onCancel={onClose}
          cancelLabel={cancelLabel}
          cancelDisabled={pending}
          cancelTestId={cancelTestId}
        >
          <Button
            type="submit"
            data-testid={submitTestId}
            variant={destructive ? "danger" : "primary"}
            disabled={!ok}
            loading={pending}
            loadingLabel={pendingLabel}
          >
            {confirmLabel}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
