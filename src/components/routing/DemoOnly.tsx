/**
 * Wraps routes that require `isDemoActive`; redirects anonymous visitors to home.
 */
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAccessGate } from "../../contexts/AccessGateContext";

type DemoOnlyProps = {
  children: ReactNode;
};

export default function DemoOnly({ children }: DemoOnlyProps) {
  const { isDemoActive } = useAccessGate();
  if (!isDemoActive) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
