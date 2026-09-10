import type { ReactNode } from "react";
import { cx, PAGE_SHELL, PAGE_WIDTH, type PageWidth } from "../../theme/shells";

export default function PageShell({
  width = "wide",
  className,
  children,
}: {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx(PAGE_SHELL, PAGE_WIDTH[width], className)}>
      {children}
    </div>
  );
}
