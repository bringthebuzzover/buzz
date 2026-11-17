import { useState, useCallback, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  GraduationCap,
  Sparkles,
  X,
} from "lucide-react";
import { MOTION } from "../../../theme/motion";
import { focusRingClass } from "../../../theme/controls";
import { cn } from "../../../theme/cn";

export type AuthMode = "signup" | "login";
export type AccountType = "organization" | "brand";

export interface AuthChooserModalProps {
  isOpen?: boolean;
  initialMode?: AuthMode;
  initialType?: AccountType;
  onClose: () => void;
  onSelect?: (type: AccountType, mode: AuthMode) => void;
}

export default function AuthChooserModal({
  isOpen = true,
  initialMode = "signup",
  initialType = "brand",
  onClose,
  onSelect,
}: AuthChooserModalProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(isOpen);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [selectedType, setSelectedType] = useState<AccountType>(initialType);

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialType) {
      setSelectedType(initialType);
    }
  }, [initialType]);

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose();
  }, [onClose]);

  const handleContinue = useCallback(() => {
    if (onSelect) {
      onSelect(selectedType, mode);
    }
    handleClose();

    let target = "/org/apply";
    if (selectedType === "organization") {
      target = mode === "signup" ? "/org/apply" : "/login";
    } else {
      target = mode === "signup" ? "/brand/apply" : "/brand/login";
    }
    navigate(target);
  }, [selectedType, mode, onSelect, handleClose, navigate]);

  const isSignup = mode === "signup";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-buzzModal bg-black/70 backdrop-blur-md buzz-scrim-atmosphere",
            MOTION.scrim,
          )}
        />
        <Dialog.Content
          aria-describedby="auth-chooser-description"
          className={cn(
            "fixed left-1/2 top-1/2 z-buzzModal w-[calc(100vw-2rem)] max-w-[700px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-white/10 bg-[#0f0e11]/90 p-6 sm:p-9 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-2xl focus:outline-none",
            MOTION.modal,
          )}
        >
          {/* Ambient subtle color orbs behind glass */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-[80px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-pink-500/10 blur-[80px]"
          />

          {/* Close button */}
          <Dialog.Close
            className={cn(
              "absolute right-4 top-4 sm:right-6 sm:top-6 z-10 flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white",
              focusRingClass,
            )}
            aria-label="Close"
          >
            <X size={16} aria-hidden />
          </Dialog.Close>

          {/* Modal Header */}
          <div className="text-center pt-2 sm:pt-4">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wide text-white/70 mb-3">
              <Sparkles size={12} className="text-accent" />
              <span>{isSignup ? "JOIN THE COMMUNITY" : "WELCOME BACK"}</span>
            </div>

            <Dialog.Title className="text-2xl sm:text-[32px] font-semibold tracking-tight text-white leading-tight">
              {isSignup ? "How are you joining BUZZ?" : "How are you logging into BUZZ?"}
            </Dialog.Title>

            <Dialog.Description
              id="auth-chooser-description"
              className="mt-2 text-xs sm:text-sm text-white/55 max-w-md mx-auto"
            >
              {isSignup
                ? "Select your account type to launch your campus activations or collaborate on brand drops."
                : "Choose your workspace portal to continue with your account."}
            </Dialog.Description>
          </div>

          {/* Selection Cards Grid */}
          <div
            role="radiogroup"
            aria-label="Account type"
            className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {/* Card: Organization */}
            <div
              role="radio"
              tabIndex={0}
              aria-checked={selectedType === "organization"}
              onClick={() => setSelectedType("organization")}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  setSelectedType("organization");
                }
              }}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl p-5 sm:p-6 cursor-pointer border text-left transition-all duration-200 select-none",
                selectedType === "organization"
                  ? "border-amber-400/80 shadow-[0_0_24px_rgba(217,180,74,0.18),inset_0_1px_0_rgba(255,235,160,0.2)]"
                  : "border-white/10 hover:border-amber-400/40 hover:bg-white/[0.02]",
                focusRingClass,
              )}
              style={{
                background:
                  selectedType === "organization"
                    ? "radial-gradient(120% 120% at 20% 0%, rgba(217, 180, 74, 0.18) 0%, rgba(36, 32, 16, 0.45) 50%, rgba(16, 15, 17, 0.95) 100%)"
                    : "radial-gradient(120% 120% at 20% 0%, rgba(217, 180, 74, 0.08) 0%, rgba(24, 22, 14, 0.3) 50%, rgba(16, 15, 17, 0.8) 100%)",
              }}
            >
              {/* Card Header: Icon & Radio */}
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                    selectedType === "organization"
                      ? "border-amber-400/30 bg-amber-400/15 text-amber-300"
                      : "border-white/10 bg-white/5 text-white/50 group-hover:text-amber-300/80",
                  )}
                >
                  <GraduationCap size={18} />
                </div>
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-150",
                    selectedType === "organization"
                      ? "border-amber-400 bg-amber-400 text-black shadow-sm"
                      : "border-white/30 group-hover:border-white/50",
                  )}
                >
                  {selectedType === "organization" ? (
                    <Check size={12} strokeWidth={3} />
                  ) : null}
                </div>
              </div>

              {/* Card Body */}
              <div className="mt-4 sm:mt-5">
                <h3 className="text-lg font-semibold text-white tracking-tight group-hover:text-amber-100 transition-colors">
                  Organization
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-white/60 leading-relaxed">
                  For student organizations and campus communities.
                </p>

                {/* Feature highlight badges */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-medium text-amber-200/90">
                    Free merch drops
                  </span>
                  <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-medium text-amber-200/90">
                    Instagram verified
                  </span>
                  <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-medium text-amber-200/90">
                    Campus activations
                  </span>
                </div>
              </div>

              {/* Card Footer: Action Indicator */}
              <div className="mt-6 flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[11px] font-medium text-white/40 group-hover:text-amber-200/60 transition-colors">
                  {isSignup ? "Apply as organization" : "Log in to org portal"}
                </span>
                <ArrowUpRight
                  size={16}
                  className={cn(
                    "transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
                    selectedType === "organization"
                      ? "text-amber-400"
                      : "text-white/40 group-hover:text-amber-300",
                  )}
                  aria-hidden
                />
              </div>
            </div>

            {/* Card: Brand */}
            <div
              role="radio"
              tabIndex={0}
              aria-checked={selectedType === "brand"}
              onClick={() => setSelectedType("brand")}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  setSelectedType("brand");
                }
              }}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl p-5 sm:p-6 cursor-pointer border text-left transition-all duration-200 select-none",
                selectedType === "brand"
                  ? "border-pink-500/90 shadow-[0_0_24px_rgba(236,72,153,0.22),inset_0_1px_0_rgba(255,182,217,0.25)]"
                  : "border-white/10 hover:border-pink-400/40 hover:bg-white/[0.02]",
                focusRingClass,
              )}
              style={{
                background:
                  selectedType === "brand"
                    ? "radial-gradient(120% 120% at 50% 0%, rgba(236, 72, 153, 0.22) 0%, rgba(45, 18, 34, 0.45) 50%, rgba(16, 15, 17, 0.95) 100%)"
                    : "radial-gradient(120% 120% at 50% 0%, rgba(236, 72, 153, 0.1) 0%, rgba(30, 16, 24, 0.3) 50%, rgba(16, 15, 17, 0.8) 100%)",
              }}
            >
              {/* Card Header: Icon & Radio */}
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                    selectedType === "brand"
                      ? "border-pink-500/30 bg-pink-500/15 text-pink-300"
                      : "border-white/10 bg-white/5 text-white/50 group-hover:text-pink-300/80",
                  )}
                >
                  <Building2 size={18} />
                </div>
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-150",
                    selectedType === "brand"
                      ? "border-pink-500 bg-pink-500 text-white shadow-sm"
                      : "border-white/30 group-hover:border-white/50",
                  )}
                >
                  {selectedType === "brand" ? (
                    <Check size={12} strokeWidth={3} />
                  ) : null}
                </div>
              </div>

              {/* Card Body */}
              <div className="mt-4 sm:mt-5">
                <h3 className="text-lg font-semibold text-white tracking-tight group-hover:text-pink-100 transition-colors">
                  Brand
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-white/60 leading-relaxed">
                  For businesses and companies looking to reach students.
                </p>

                {/* Feature highlight badges */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-pink-500/20 bg-pink-500/10 px-2 py-0.5 text-[10.5px] font-medium text-pink-200/90">
                    Campus reach
                  </span>
                  <span className="inline-flex items-center rounded-full border border-pink-500/20 bg-pink-500/10 px-2 py-0.5 text-[10.5px] font-medium text-pink-200/90">
                    High engagement
                  </span>
                  <span className="inline-flex items-center rounded-full border border-pink-500/20 bg-pink-500/10 px-2 py-0.5 text-[10.5px] font-medium text-pink-200/90">
                    Turnkey logistics
                  </span>
                </div>
              </div>

              {/* Card Footer: Action Indicator */}
              <div className="mt-6 flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[11px] font-medium text-white/40 group-hover:text-pink-200/60 transition-colors">
                  {isSignup ? "Apply as brand" : "Log in to brand portal"}
                </span>
                <ArrowUpRight
                  size={16}
                  className={cn(
                    "transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
                    selectedType === "brand"
                      ? "text-pink-400"
                      : "text-white/40 group-hover:text-pink-300",
                  )}
                  aria-hidden
                />
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="mt-8 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
            {/* Segmented Auth Mode Switcher */}
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => setMode("login")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer",
                  mode === "login"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/50 hover:text-white/80",
                  focusRingClass,
                )}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                onClick={() => setMode("signup")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer",
                  mode === "signup"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/50 hover:text-white/80",
                  focusRingClass,
                )}
              >
                Sign up
              </button>
            </div>

            {/* Action CTA Button */}
            <button
              type="button"
              onClick={handleContinue}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 font-medium text-sm text-black transition-all duration-150 active:scale-95 cursor-pointer shadow-[0_4px_16px_rgba(252,211,77,0.25)]",
                selectedType === "organization"
                  ? "bg-[#fcd34d] hover:bg-[#fbbf24]"
                  : "bg-[#fcd34d] hover:bg-[#fbbf24]",
                focusRingClass,
              )}
            >
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
