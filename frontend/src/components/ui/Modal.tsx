import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "../forms/controls";
import { focusRingClass } from "../../theme/controls";
import { MOTION } from "../../theme/motion";
import { SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/**
 * Dialog primitive: the pen Modal (560 wide, ink-pop, padding 32, radius-board,
 * paper-09 hairline) on the scrim.
 *
 * Radix supplies Escape to close, the focus trap, body scroll lock and
 * backdrop close. Mounted means open, matching how the modals are rendered
 * conditionally by their parents. There is no `Dialog.Trigger`, so focus
 * return is ours: whatever had focus when the modal mounted gets it back.
 *
 * Tall content (a long email body on a phone) scrolls inside the dialog.
 */
export function Modal({
  onClose,
  title,
  description,
  /** Visually hide the title while keeping it for screen readers. */
  hideTitle = false,
  className,
  children,
}: {
  onClose: () => void;
  title: string;
  description?: ReactNode;
  hideTitle?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [returnFocus] = useState(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );
  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn("fixed inset-0 z-buzzModal bg-buzz-scrim", MOTION.scrim)}
        />
        <Dialog.Content
          // Without a description Radix warns unless this is explicitly unset.
          {...(description ? {} : { "aria-describedby": undefined })}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus?.focus();
          }}
          className={cn(
            "fixed left-1/2 top-1/2 z-buzzModal flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col gap-6 overflow-y-auto focus:outline-none",
            MOTION.modal,
            SURFACE.modal,
            className,
          )}
        >
          <div className="flex items-start gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Dialog.Title className={hideTitle ? "sr-only" : cn(TEXT.h3, "text-primary")}>
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm leading-relaxed text-quiet">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className={cn(
                "-m-1 shrink-0 rounded-full p-1 text-quiet transition hover:bg-buzz-paper08 hover:text-primary",
                focusRingClass,
              )}
              aria-label="Close"
            >
              <X size={18} aria-hidden />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Pen modal footer: right-aligned, 12px gap, the ghost Cancel pill first and
 * the confirm pill(s) passed as children. Every modal uses this so the footer
 * reads the same everywhere. Omit `onCancel` for a single-action footer.
 */
export function ModalActions({
  onCancel,
  cancelLabel = "Cancel",
  cancelDisabled = false,
  cancelTestId,
  children,
}: {
  onCancel?: () => void;
  cancelLabel?: string;
  cancelDisabled?: boolean;
  cancelTestId?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {onCancel ? (
        <Button
          type="button"
          variant="ghost"
          // Pen Pill / Ghost in a modal footer is 40px with 20px padding.
          className="h-10 px-5"
          data-testid={cancelTestId}
          disabled={cancelDisabled}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
      ) : null}
      {children}
    </div>
  );
}
