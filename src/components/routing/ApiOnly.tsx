/**
 * ApiOnly — gate for routes that only exist in the API build (Stage 6/7 auth +
 * onboarding pages). With `REACT_APP_USE_API=false` there is no `AuthProvider`,
 * so these pages (and the `RequireAuth` inside them) would spin forever on
 * `status === "idle"`. In demo mode we redirect to home instead.
 */
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { USE_API } from "../../config/featureFlags";

export default function ApiOnly({ children }: { children: ReactNode }) {
  return USE_API ? <>{children}</> : <Navigate to="/" replace />;
}
