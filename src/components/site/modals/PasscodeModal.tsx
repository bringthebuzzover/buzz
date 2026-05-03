/**
 * Demo access flow — two-step modal:
 *   step 1 = passcode entry (wrong code shakes; correct code transitions in place)
 *   step 2 = persona chooser (Brand vs Student Org); choosing navigates to that view's landing.
 *
 * The modal also auto-opens at step 2 whenever the global `needsDemoViewChoice` flag is true
 * (e.g. user refreshed mid-flow, or a `DemoOnly` route detected a missing persona).
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, GraduationCap, X } from "lucide-react";
import { useAccessGate } from "../../../contexts/AccessGateContext";
import { DEMO_VIEW_LANDING } from "../../../config/accessGate";
import { DEMO_VIEW_LABELS, type DemoView } from "../../../types/access";

const TRANSITION_MS = 320;

type Step = "passcode" | "choose-view";

type ViewOption = {
  view: DemoView;
  title: string;
  description: string;
  Icon: typeof Building2;
};

const VIEW_OPTIONS: readonly ViewOption[] = [
  {
    view: "brand",
    title: DEMO_VIEW_LABELS.brand,
    description:
      "Sales-led portal: track your drop request, monitor campaign performance, and review aggregate analytics.",
    Icon: Building2,
  },
  {
    view: "org",
    title: DEMO_VIEW_LABELS.org,
    description:
      "Self-serve portal: browse the drop feed, apply to campaigns, and manage your active participation.",
    Icon: GraduationCap,
  },
];

export default function PasscodeModal() {
  const navigate = useNavigate();
  const {
    isPasscodeModalOpen,
    closePasscodeModal,
    openPasscodeModal,
    submitDemoPasscode,
    isDemoActive,
    needsDemoViewChoice,
    setDemoView,
  } = useAccessGate();

  const [step, setStep] = useState<Step>("passcode");
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const prevNeedsChoiceRef = useRef(needsDemoViewChoice);
  const wasOpenRef = useRef(isPasscodeModalOpen);

  /**
   * Reset modal state only on the open transition (closed -> open). This avoids clobbering
   * the in-flight passcode-submit animation when `isDemoActive` flips while the modal is
   * already visible.
   */
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isPasscodeModalOpen;
    if (!isPasscodeModalOpen || wasOpen) {
      return;
    }
    setCode("");
    setShake(false);
    setTransitioning(false);
    setStep(isDemoActive ? "choose-view" : "passcode");
  }, [isPasscodeModalOpen, isDemoActive]);

  /**
   * Auto-open the chooser only on a transition (false -> true) of `needsDemoViewChoice`.
   * This covers refresh-mid-flow (initial render evaluates true) without re-opening every
   * time the user dismisses the chooser without selecting (it stays true until they pick).
   * Protected routes are still re-prompted by `DemoOnly`'s own effect.
   */
  useEffect(() => {
    const wasNeeding = prevNeedsChoiceRef.current;
    prevNeedsChoiceRef.current = needsDemoViewChoice;
    if (needsDemoViewChoice && !wasNeeding && !isPasscodeModalOpen) {
      openPasscodeModal();
    }
  }, [needsDemoViewChoice, isPasscodeModalOpen, openPasscodeModal]);

  if (!isPasscodeModalOpen) {
    return null;
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (transitioning) return;
    if (submitDemoPasscode(code)) {
      setTransitioning(true);
      window.setTimeout(() => {
        setStep("choose-view");
        setTransitioning(false);
      }, TRANSITION_MS);
    } else {
      setShake(true);
      window.setTimeout(() => setShake(false), 480);
    }
  };

  const handleChooseView = (view: DemoView) => {
    if (transitioning) return;
    setTransitioning(true);
    setDemoView(view);
    window.setTimeout(() => {
      closePasscodeModal();
      navigate(DEMO_VIEW_LANDING[view]);
    }, TRANSITION_MS);
  };

  const isChooserStep = step === "choose-view";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-buzz-overlay/55 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="passcode-modal-title"
    >
      <div
        className={`w-full transition-all duration-[320ms] ease-out ${
          isChooserStep ? "max-w-2xl" : "max-w-md"
        } ${transitioning ? "scale-[0.98] opacity-0" : "scale-100 opacity-100"}`}
      >
        <div
          className={`relative overflow-hidden rounded-2xl border-2 border-buzz-lineMid bg-buzz-paper shadow-buzzLg ${
            shake ? "animate-shake" : ""
          }`}
        >
          <button
            type="button"
            onClick={closePasscodeModal}
            disabled={transitioning}
            className="absolute right-4 top-4 z-10 rounded-full border border-buzz-line bg-buzz-cream p-1 text-buzz-inkFaint shadow-sm transition hover:text-buzz-coral disabled:opacity-40"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {isChooserStep ? (
            <ChooserStep
              onChoose={handleChooseView}
              disabled={transitioning}
            />
          ) : (
            <PasscodeStep
              code={code}
              onCodeChange={setCode}
              onSubmit={handleSubmit}
              shake={shake}
              disabled={transitioning}
            />
          )}
        </div>
      </div>
    </div>
  );
}

type PasscodeStepProps = {
  code: string;
  onCodeChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  shake: boolean;
  disabled: boolean;
};

function PasscodeStep({
  code,
  onCodeChange,
  onSubmit,
  shake,
  disabled,
}: PasscodeStepProps) {
  return (
    <>
      <div className="border-b border-buzz-line bg-buzz-coralDark px-8 pb-8 pt-10 text-center text-buzz-paper">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-buzz-paper/80">
          Demo access
        </p>
        <h2
          id="passcode-modal-title"
          className="text-2xl font-bold tracking-tight"
        >
          Enter demo code
        </h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-buzz-paper/85">
          The interactive BUZZ preview is for invited teams only. Enter your
          code to unlock the full demo experience.
        </p>
      </div>

      <form className="space-y-5 p-8" onSubmit={onSubmit}>
        <div>
          <label
            htmlFor="demo-access-code"
            className="mb-2 block text-xs font-bold uppercase tracking-wider text-buzz-inkFaint"
          >
            Access code
          </label>
          <input
            id="demo-access-code"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="Enter code"
            className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream px-4 py-3 text-sm text-buzz-ink outline-none transition focus:border-buzz-coral focus:ring-2 focus:ring-buzz-coral"
          />
        </div>
        {shake ? (
          <p
            className="text-center text-xs font-semibold text-buzz-coral"
            role="alert"
          >
            That code doesn&apos;t match. Please try again.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={disabled || !code.trim()}
          className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Unlock demo
        </button>
      </form>
    </>
  );
}

type ChooserStepProps = {
  onChoose: (view: DemoView) => void;
  disabled: boolean;
};

function ChooserStep({ onChoose, disabled }: ChooserStepProps) {
  return (
    <>
      <div className="border-b border-buzz-line bg-buzz-coralDark px-8 pb-8 pt-10 text-center text-buzz-paper">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-buzz-paper/80">
          Demo access unlocked
        </p>
        <h2
          id="passcode-modal-title"
          className="text-2xl font-bold tracking-tight"
        >
          Choose your view
        </h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-buzz-paper/85">
          Buzz has two separate experiences. Pick how you want to explore the
          demo. You can switch any time from the header.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 sm:p-8">
        {VIEW_OPTIONS.map(({ view, title, description, Icon }) => (
          <button
            key={view}
            type="button"
            onClick={() => onChoose(view)}
            disabled={disabled}
            className="group flex h-full flex-col items-start gap-3 rounded-xl border-2 border-buzz-lineMid bg-buzz-cream p-6 text-left shadow-sm transition enabled:hover:border-buzz-coral enabled:hover:bg-buzz-butter enabled:hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-buzz-paper text-buzz-coral shadow-sm ring-1 ring-buzz-lineMid transition group-enabled:group-hover:bg-buzz-coral group-enabled:group-hover:text-buzz-paper">
              <Icon size={22} strokeWidth={2} aria-hidden />
            </span>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-buzz-ink">
                See as {title}
              </h3>
              <p className="text-sm font-medium leading-relaxed text-buzz-inkMuted">
                {description}
              </p>
            </div>
            <span className="mt-auto pt-2 text-xs font-bold uppercase tracking-wider text-buzz-coral">
              Continue &rarr;
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
