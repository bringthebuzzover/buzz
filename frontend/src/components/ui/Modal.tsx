import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { focusRingClass } from "../../theme/controls";
import { MOTION } from "../../theme/motion";
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
  /** `default` is the pen 560px dialog. `narrow` is confirms. `wide` is forms. */
  size?: "default" | "wide" | "narrow";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-buzzModal bg-buzz-scrim",
            MOTION.scrim,
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-buzzModal flex w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden focus:outline-none",
            MOTION.modal,
            size === "narrow" ? "max-w-sm" : size === "wide" ? "max-w-[720px]" : "max-w-[560px]",
            SURFACE.modal,
            className,
          )}
        >
          <div className="flex flex-col gap-2 pr-8">
            <Dialog.Title className={hideTitle ? "sr-only" : TEXT.h3}>
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description className={cn(TEXT.meta, "leading-relaxed")}>
                {description}
              </Dialog.Description>
            )}
          </div>
          <Dialog.Close
            className={cn(
              "absolute right-8 top-8 z-10 rounded-full p-1 text-quiet transition hover:bg-buzz-neutral hover:text-primary",
              focusRingClass,
            )}
            aria-label="Close"
          >
            <X size={18} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
