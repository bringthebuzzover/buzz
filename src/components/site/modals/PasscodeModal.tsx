/**
 * Demo access passcode overlay — wrong code shakes the card; correct code dissolves then closes.
 */
import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useAccessGate } from "../../../contexts/AccessGateContext";

const DISSOLVE_MS = 420;

export default function PasscodeModal() {
  const { isPasscodeModalOpen, closePasscodeModal, submitDemoPasscode } =
    useAccessGate();
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(false);
  const [dissolving, setDissolving] = useState(false);

  useEffect(() => {
    if (isPasscodeModalOpen) {
      setCode("");
      setShake(false);
      setDissolving(false);
    }
  }, [isPasscodeModalOpen]);

  if (!isPasscodeModalOpen) {
    return null;
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (dissolving) return;
    if (submitDemoPasscode(code)) {
      setDissolving(true);
      window.setTimeout(() => {
        closePasscodeModal();
      }, DISSOLVE_MS);
    } else {
      setShake(true);
      window.setTimeout(() => setShake(false), 480);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-buzz-overlay/55 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="passcode-modal-title"
    >
      <div
        className={`w-full max-w-md transition-all duration-[420ms] ease-out ${
          dissolving
            ? "pointer-events-none scale-[0.96] opacity-0"
            : "scale-100 opacity-100"
        }`}
      >
        <div
          className={`relative overflow-hidden rounded-2xl border-2 border-buzz-lineMid bg-buzz-paper shadow-buzzLg ${
            shake ? "animate-shake" : ""
          }`}
        >
          <button
            type="button"
            onClick={closePasscodeModal}
            disabled={dissolving}
            className="absolute right-4 top-4 z-10 rounded-full border border-buzz-line bg-buzz-cream p-1 text-buzz-inkFaint shadow-sm transition hover:text-buzz-coral disabled:opacity-40"
            aria-label="Close"
          >
            <X size={20} />
          </button>

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

          <form className="space-y-5 p-8" onSubmit={handleSubmit}>
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
                onChange={(e) => setCode(e.target.value)}
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
              disabled={dissolving || !code.trim()}
              className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Unlock demo
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
