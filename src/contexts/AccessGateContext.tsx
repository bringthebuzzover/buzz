/**
 * Global demo gate: `isDemoActive` is false for the public landing experience and true after passcode
 * (persisted in sessionStorage). Mount `PasscodeModal` next to `AppRoot` under this provider (avoids import cycle).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEMO_SESSION_KEY,
  DEMO_SESSION_VALUE,
  getDemoAccessPasscode,
} from "../config/accessGate";

type AccessGateValue = {
  /** Full interactive site when true; public lead-gen landing when false. */
  isDemoActive: boolean;
  isPasscodeModalOpen: boolean;
  openPasscodeModal: () => void;
  closePasscodeModal: () => void;
  /** Validates passcode; on success sets demo active + session token. */
  submitDemoPasscode: (code: string) => boolean;
  /** Clears demo session and returns UI to public mode. */
  exitDemo: () => void;
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
  const [isDemoActive, setIsDemoActive] = useState(false);
  const [isPasscodeModalOpen, setPasscodeModalOpen] = useState(false);

  useEffect(() => {
    setIsDemoActive(readDemoSession());
  }, []);

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
    setIsDemoActive(false);
  }, []);

  const openPasscodeModal = useCallback(() => setPasscodeModalOpen(true), []);
  const closePasscodeModal = useCallback(() => setPasscodeModalOpen(false), []);

  const value = useMemo(
    () => ({
      isDemoActive,
      isPasscodeModalOpen,
      openPasscodeModal,
      closePasscodeModal,
      submitDemoPasscode,
      exitDemo,
    }),
    [
      isDemoActive,
      isPasscodeModalOpen,
      openPasscodeModal,
      closePasscodeModal,
      submitDemoPasscode,
      exitDemo,
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
