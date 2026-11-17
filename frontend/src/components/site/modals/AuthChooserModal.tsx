import { useState, useCallback, useRef, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Check, X } from "lucide-react";
import { MOTION } from "../../../theme/motion";
import { focusRingClass } from "../../../theme/controls";
import { TEXT, SURFACE } from "../../../theme/tokens";
import { cn } from "../../../theme/cn";

export type AuthMode = "signup" | "login";
export type AccountType = "organization" | "brand";

export interface AuthChooserModalProps {
  initialMode?: AuthMode;
  initialType?: AccountType;
  onClose: () => void;
  onSelect?: (type: AccountType, mode: AuthMode) => void;
}

export default function AuthChooserModal({
  initialMode = "signup",
  initialType,
  onClose,
  onSelect,
}: AuthChooserModalProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const closingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [hoveredType, setHoveredType] = useState<AccountType | null>(initialType ?? null);

  const [returnFocus] = useState(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const requestClose = useCallback(
    (customAction?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      setOpen(false);

      const execute = () => {
        if (customAction) {
          customAction();
          if (customAction !== onCloseRef.current) {
            onCloseRef.current();
          }
        } else {
          onCloseRef.current();
        }
      };

      const isTest =
        typeof process !== "undefined" && process.env?.NODE_ENV === "test";
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (isTest || prefersReducedMotion) {
        execute();
      } else {
        timerRef.current = window.setTimeout(execute, 150);
      }
    },
    [],
  );

  const handleChoose = useCallback(
    (type: AccountType) => {
      if (onSelect) {
        onSelect(type, mode);
      }

      let target = "/org/apply";
      if (type === "organization") {
        target = mode === "signup" ? "/org/apply" : "/login";
      } else {
        target = mode === "signup" ? "/brand/apply" : "/brand/login";
      }

      requestClose(() => navigate(target));
    },
    [mode, onSelect, requestClose, navigate],
  );

  const isSignup = mode === "signup";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn("fixed inset-0 z-buzzModal buzz-scrim-atmosphere", MOTION.scrim)}
        />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (
              returnFocus &&
              typeof returnFocus.focus === "function" &&
              document.body.contains(returnFocus) &&
              !returnFocus.closest('[aria-hidden="true"]')
            ) {
              returnFocus.focus();
            }
          }}
          className={cn(
            "fixed left-1/2 top-1/2 z-buzzModal max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[680px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-6 sm:p-9 focus:outline-none",
            SURFACE.glassModal,
            MOTION.modal,
          )}
        >
          {/* Ambient subtle color orbs behind glass */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl motion-reduce:hidden"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-buzz-pink/10 blur-3xl motion-reduce:hidden"
          />

          {/* Close button */}
          <Dialog.Close
            className={cn(
              "absolute right-4 top-4 sm:right-6 sm:top-6 z-10 flex h-8 w-8 items-center justify-center rounded-buzzControl border border-line bg-buzz-paper04 text-quiet transition-colors hover:bg-buzz-paper08 hover:text-primary cursor-pointer motion-reduce:transition-none",
              focusRingClass,
            )}
            aria-label="Close"
          >
            <X size={16} aria-hidden />
          </Dialog.Close>

          {/* Modal Header */}
          <div className="text-center pt-2 sm:pt-4">
            <Dialog.Title className={cn(TEXT.h2, "text-primary text-center")}>
              {isSignup ? "How are you joining BUZZ?" : "How are you logging into BUZZ?"}
            </Dialog.Title>

            <Dialog.Description className="mt-2 text-sm text-quiet max-w-md mx-auto leading-relaxed">
              {isSignup
                ? "Select your account type to get started."
                : "Select your account type to access your portal."}
            </Dialog.Description>
          </div>

          {/* Selection Cards Grid */}
          <div
            role="group"
            aria-label="Account type"
            className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {/* Card: Organization */}
            <button
              type="button"
              onClick={() => handleChoose("organization")}
              onMouseEnter={() => setHoveredType("organization")}
              onFocus={() => setHoveredType("organization")}
              className={cn(
                "group relative flex min-h-[180px] sm:min-h-[200px] flex-col justify-between rounded-buzzBoard p-6 cursor-pointer border text-left transition-all duration-200 select-none motion-reduce:transition-none",
                hoveredType === "organization"
                  ? "border-accent/80 shadow-[0_0_24px_rgba(246,211,42,0.18),inset_0_1px_0_rgba(255,235,160,0.2)]"
                  : "border-line hover:border-accent/40 hover:bg-buzz-paper04",
                MOTION.press,
                focusRingClass,
              )}
              style={{
                background:
                  hoveredType === "organization"
                    ? "radial-gradient(120% 120% at 20% 0%, rgba(246, 211, 42, 0.18) 0%, rgba(36, 32, 16, 0.45) 50%, rgba(16, 15, 17, 0.95) 100%)"
                    : "radial-gradient(120% 120% at 20% 0%, rgba(246, 211, 42, 0.08) 0%, rgba(24, 22, 14, 0.3) 50%, rgba(16, 15, 17, 0.8) 100%)",
              }}
            >
              {/* Check Indicator (Top Right) */}
              <div className="flex justify-end">
                <div
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-150 motion-reduce:transition-none",
                    hoveredType === "organization"
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line group-hover:border-buzz-fg/50",
                  )}
                >
                  {hoveredType === "organization" ? (
                    <Check size={12} strokeWidth={3} />
                  ) : null}
                </div>
              </div>

              {/* Card Body */}
              <div className="my-auto">
                <h3 className={cn(TEXT.h3, "text-primary tracking-tight transition-colors motion-reduce:transition-none")}>
                  Organization
                </h3>
                <p className="mt-1.5 text-sm text-muted leading-relaxed">
                  For student organizations and campus communities.
                </p>
              </div>

              {/* Card Footer: Action Indicator */}
              <div className="flex items-center justify-end pt-2">
                <ArrowUpRight
                  size={18}
                  className={cn(
                    "transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none",
                    hoveredType === "organization"
                      ? "text-accent"
                      : "text-quiet group-hover:text-accent",
                  )}
                  aria-hidden
                />
              </div>
            </button>

            {/* Card: Brand */}
            <button
              type="button"
              onClick={() => handleChoose("brand")}
              onMouseEnter={() => setHoveredType("brand")}
              onFocus={() => setHoveredType("brand")}
              className={cn(
                "group relative flex min-h-[180px] sm:min-h-[200px] flex-col justify-between rounded-buzzBoard p-6 cursor-pointer border text-left transition-all duration-200 select-none motion-reduce:transition-none",
                hoveredType === "brand"
                  ? "border-buzz-pink/90 shadow-[0_0_24px_rgba(241,123,191,0.22),inset_0_1px_0_rgba(255,182,217,0.25)]"
                  : "border-line hover:border-buzz-pink/40 hover:bg-buzz-paper04",
                MOTION.press,
                focusRingClass,
              )}
              style={{
                background:
                  hoveredType === "brand"
                    ? "radial-gradient(120% 120% at 50% 0%, rgba(241, 123, 191, 0.22) 0%, rgba(45, 18, 34, 0.45) 50%, rgba(16, 15, 17, 0.95) 100%)"
                    : "radial-gradient(120% 120% at 50% 0%, rgba(241, 123, 191, 0.1) 0%, rgba(30, 16, 24, 0.3) 50%, rgba(16, 15, 17, 0.8) 100%)",
              }}
            >
              {/* Check Indicator (Top Right) */}
              <div className="flex justify-end">
                <div
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-150 motion-reduce:transition-none",
                    hoveredType === "brand"
                      ? "border-buzz-pink bg-buzz-pink text-on-accent"
                      : "border-line group-hover:border-buzz-fg/50",
                  )}
                >
                  {hoveredType === "brand" ? (
                    <Check size={12} strokeWidth={3} />
                  ) : null}
                </div>
              </div>

              {/* Card Body */}
              <div className="my-auto">
                <h3 className={cn(TEXT.h3, "text-primary tracking-tight transition-colors motion-reduce:transition-none")}>
                  Brand
                </h3>
                <p className="mt-1.5 text-sm text-muted leading-relaxed">
                  For businesses and companies looking to reach students.
                </p>
              </div>

              {/* Card Footer: Action Indicator */}
              <div className="flex items-center justify-end pt-2">
                <ArrowUpRight
                  size={18}
                  className={cn(
                    "transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none",
                    hoveredType === "brand"
                      ? "text-buzz-pink"
                      : "text-quiet group-hover:text-buzz-pink",
                  )}
                  aria-hidden
                />
              </div>
            </button>
          </div>

          {/* Modal Footer Controls: Centered Auth Mode Switcher */}
          <div className="mt-8 flex items-center justify-center pt-2">
            <div
              role="group"
              aria-label="Authentication mode"
              className="inline-flex items-center rounded-full border border-line bg-surface-pop p-1 backdrop-blur-md"
            >
              <button
                type="button"
                aria-pressed={mode === "login"}
                onClick={() => setMode("login")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer motion-reduce:transition-none",
                  mode === "login"
                    ? "bg-buzz-paper08 text-primary"
                    : "text-quiet hover:text-primary",
                  focusRingClass,
                )}
              >
                Log in
              </button>
              <button
                type="button"
                aria-pressed={mode === "signup"}
                onClick={() => setMode("signup")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer motion-reduce:transition-none",
                  mode === "signup"
                    ? "bg-buzz-paper08 text-primary"
                    : "text-quiet hover:text-primary",
                  focusRingClass,
                )}
              >
                Sign up
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
