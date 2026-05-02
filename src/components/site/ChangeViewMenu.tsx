/**
 * Demo-only header dropdown that lets internal users switch between Brand and Student Org views,
 * or exit the demo entirely. Renders nothing for public visitors.
 *
 * Behavior:
 *   - "See as Brand"        -> setDemoView("brand")  + navigate to brand landing
 *   - "See as Student Org"  -> setDemoView("org")    + navigate to org landing
 *   - "Exit Demo View"      -> exitDemo() + navigate to "/"
 *   - The currently active view is shown as the trigger label and disabled in the menu.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, LogOut } from "lucide-react";
import { useAccessGate } from "../../contexts/AccessGateContext";
import { DEMO_VIEW_LANDING } from "../../config/accessGate";
import { DEMO_VIEW_LABELS, type DemoView } from "../../types/access";

export default function ChangeViewMenu() {
  const navigate = useNavigate();
  const { isDemoActive, demoView, setDemoView, exitDemo } = useAccessGate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, close]);

  if (!isDemoActive) {
    return null;
  }

  const handleSelectView = (view: DemoView) => {
    close();
    if (view === demoView) return;
    setDemoView(view);
    navigate(DEMO_VIEW_LANDING[view]);
  };

  const handleExit = () => {
    close();
    exitDemo();
    navigate("/", { replace: true });
  };

  const triggerLabel = demoView
    ? `Viewing: ${DEMO_VIEW_LABELS[demoView]}`
    : "Change View";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 font-bold text-buzz-coral transition hover:underline"
      >
        <span>{triggerLabel}</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Change demo view"
          className="absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 overflow-hidden rounded-xl border border-buzz-lineMid bg-buzz-paper shadow-buzzLg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelectView("brand")}
            disabled={demoView === "brand"}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-bold text-buzz-ink transition enabled:hover:bg-buzz-butter disabled:cursor-default disabled:text-buzz-coral"
          >
            <span>See as Brand</span>
            {demoView === "brand" ? (
              <Check size={14} className="text-buzz-coral" aria-hidden />
            ) : null}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelectView("org")}
            disabled={demoView === "org"}
            className="flex w-full items-center justify-between gap-3 border-t border-buzz-line px-4 py-3 text-left text-sm font-bold text-buzz-ink transition enabled:hover:bg-buzz-butter disabled:cursor-default disabled:text-buzz-coral"
          >
            <span>See as Student Org</span>
            {demoView === "org" ? (
              <Check size={14} className="text-buzz-coral" aria-hidden />
            ) : null}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleExit}
            className="flex w-full items-center gap-2 border-t border-buzz-line bg-buzz-cream px-4 py-3 text-left text-sm font-bold text-buzz-coral transition hover:bg-buzz-butter"
          >
            <LogOut size={14} aria-hidden />
            <span>Exit Demo View</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
