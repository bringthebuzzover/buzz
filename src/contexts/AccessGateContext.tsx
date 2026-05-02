/**
 * Global demo gate: `isDemoActive` is false for the public landing experience and true after passcode
 * (persisted in sessionStorage). Once active, demo users also choose a `demoView` ("brand" | "org")
 * which determines route access and chrome behavior. Mount `PasscodeModal` next to `AppRoot` under
 * this provider (avoids import cycle).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEMO_SESSION_KEY,
  DEMO_SESSION_VALUE,
  getDemoAccessPasscode,
  readDemoViewFromStorage,
  writeDemoViewToStorage,
} from "../config/accessGate";
import type { DemoView } from "../types/access";

type AccessGateValue = {
  /** Full interactive site when true; public lead-gen landing when false. */
  isDemoActive: boolean;
  isPasscodeModalOpen: boolean;
  openPasscodeModal: () => void;
  closePasscodeModal: () => void;
  /** Validates passcode; on success sets demo active + session token. */
  submitDemoPasscode: (code: string) => boolean;
  /** Clears demo session (and demo view) and returns UI to public mode. */
  exitDemo: () => void;
  /** Selected demo persona; `null` until the chooser step has been completed. */
  demoView: DemoView | null;
  /** Persist a chosen demo persona for this session. */
  setDemoView: (view: DemoView) => void;
  /** Clear the chosen demo persona (without exiting the demo session). */
  clearDemoView: () => void;
  /** True when demo is unlocked but no persona has been chosen yet. */
  needsDemoViewChoice: boolean;
};

const AccessGateContext = createContext<AccessGateValue | null>(null);

function readDemoSession(): boolean {
  try {
    return sessionStorage.getItem(DEMO_SESSION_KEY) === DEMO_SESSION_VALUE;
  } catch {
    return false;
  }
}

export function AccessGateProvider({ children }: { children: ReactNode }) {
  /**
   * Lazy initial state reads sessionStorage during the very first render so refreshing a
   * protected route (e.g. /brand) keeps the user there instead of momentarily redirecting
   * to "/" before a hydration effect catches up.
   */
  const [isDemoActive, setIsDemoActive] = useState<boolean>(() =>
    readDemoSession()
  );
  const [isPasscodeModalOpen, setPasscodeModalOpen] = useState(false);
  const [demoView, setDemoViewState] = useState<DemoView | null>(() =>
    readDemoSession() ? readDemoViewFromStorage() : null
  );

  const submitDemoPasscode = useCallback((code: string) => {
    const expected = getDemoAccessPasscode();
    if (code.trim() !== expected) {
      return false;
    }
    try {
      sessionStorage.setItem(DEMO_SESSION_KEY, DEMO_SESSION_VALUE);
    } catch {
      /* in-memory only */
    }
    setIsDemoActive(true);
    return true;
  }, []);

  const exitDemo = useCallback(() => {
    try {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
    } catch {
      /* ignore */
    }
    writeDemoViewToStorage(null);
    setDemoViewState(null);
    setIsDemoActive(false);
  }, []);

  const openPasscodeModal = useCallback(() => setPasscodeModalOpen(true), []);
  const closePasscodeModal = useCallback(() => setPasscodeModalOpen(false), []);

  const setDemoView = useCallback((view: DemoView) => {
    writeDemoViewToStorage(view);
    setDemoViewState(view);
  }, []);

  const clearDemoView = useCallback(() => {
    writeDemoViewToStorage(null);
    setDemoViewState(null);
  }, []);

  const needsDemoViewChoice = isDemoActive && demoView == null;

  const value = useMemo(
    () => ({
      isDemoActive,
      isPasscodeModalOpen,
      openPasscodeModal,
      closePasscodeModal,
      submitDemoPasscode,
      exitDemo,
      demoView,
      setDemoView,
      clearDemoView,
      needsDemoViewChoice,
    }),
    [
      isDemoActive,
      isPasscodeModalOpen,
      openPasscodeModal,
      closePasscodeModal,
      submitDemoPasscode,
      exitDemo,
      demoView,
      setDemoView,
      clearDemoView,
      needsDemoViewChoice,
    ]
  );

  return (
    <AccessGateContext.Provider value={value}>{children}</AccessGateContext.Provider>
  );
}

export function useAccessGate(): AccessGateValue {
  const ctx = useContext(AccessGateContext);
  if (!ctx) {
    throw new Error("useAccessGate must be used within AccessGateProvider");
  }
  return ctx;
}
