import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/**
 * Dialog primitive.
 *
 * Buzz's modals were plain fixed divs: no Escape handler, no focus trap, no
 * body scroll lock, and no backdrop close, so the page behind stayed scrollable
 * and keyboard users could tab out of the dialog. Radix supplies all four,
 * which is the whole reason it is a dependency here.
 *
 * Mounted means open, matching how the existing modals are rendered
 * conditionally by their parents.
 */
export function Modal({
  onClose,
  title,
  description,
  /** Visually hide the title while keeping it for screen readers. */
  hideTitle = false,
  size = "default",
  className,
  children,
}: {
  onClose: () => void;
  title: string;
  description?: string;
  hideTitle?: boolean;
  size?: "default" | "wide";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-buzzModal bg-buzz-overlay/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-buzzModal w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden focus:outline-none",
            size === "wide" ? "max-w-lg" : "max-w-sm",
            SURFACE.modal,
            className,
          )}
        >
          <Dialog.Title className={hideTitle ? "sr-only" : cn(TEXT.h2, "px-6 pt-6")}>
            {title}
          </Dialog.Title>
          {description && (
            <Dialog.Description className={cn(TEXT.meta, "px-6 pt-1")}>
              {description}
            </Dialog.Description>
          )}
          <Dialog.Close
            className="absolute right-4 top-4 z-10 rounded-full p-1 text-buzz-inkMuted transition hover:bg-buzz-neutral hover:text-buzz-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-buzz-coral/40"
            aria-label="Close"
          >
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
