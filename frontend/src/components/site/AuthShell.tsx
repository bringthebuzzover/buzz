import type { ReactNode } from "react";
import { AUTH_SHELL, cx, type AuthShellAlign } from "../../theme/shells";

/**
 * `data-testid` is here for `e2e/layout.spec.ts`, which measures the gap above
 * and below the shell's content to prove centered auth pages are actually
 * centered between header and footer — the old min-height guess used to hide.
 */
export default function AuthShell({
  align,
  className,
  children,
}: {
  align: AuthShellAlign;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div data-testid="auth-shell" className={cx(AUTH_SHELL[align], className)}>
      {children}
    </div>
  );
}
