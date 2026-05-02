/**
 * Wraps routes that require the demo session to be unlocked. Optionally enforces a specific
 * `requiredDemoView` (Brand or Student Org). Behavior:
 *   1. Demo not active           -> redirect to "/".
 *   2. Demo active, no view set  -> open the persona chooser (PasscodeModal step 2); render nothing.
 *   3. Required view mismatch    -> redirect to the current view's landing.
 *   4. Otherwise                 -> render children.
 */
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAccessGate } from "../../contexts/AccessGateContext";
import { DEMO_VIEW_LANDING } from "../../config/accessGate";
import type { DemoView } from "../../types/access";

type DemoOnlyProps = {
  children: ReactNode;
  /** When set, only allow demo users currently viewing this persona. */
  requiredDemoView?: DemoView;
};

export default function DemoOnly({ children, requiredDemoView }: DemoOnlyProps) {
  const { isDemoActive, demoView, openPasscodeModal } = useAccessGate();

  const needsChooser = isDemoActive && demoView == null;

  useEffect(() => {
    if (needsChooser) {
      openPasscodeModal();
    }
  }, [needsChooser, openPasscodeModal]);

  if (!isDemoActive) {
    return <Navigate to="/" replace />;
  }

  if (demoView == null) {
    return null;
  }

  if (requiredDemoView != null && requiredDemoView !== demoView) {
    return <Navigate to={DEMO_VIEW_LANDING[demoView]} replace />;
  }

  return <>{children}</>;
}
