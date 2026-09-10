import type { ReactNode } from "react";
import { AUTH_SHELL, cx, type AuthShellAlign } from "../../theme/shells";

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
    <div className={cx(AUTH_SHELL[align], className)}>{children}</div>
  );
}
