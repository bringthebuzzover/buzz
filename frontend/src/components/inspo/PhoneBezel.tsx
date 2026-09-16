/**
 * Simple phone frame used on the getting-started inspo screen.
 */
import type { ReactNode } from "react";

export default function PhoneBezel({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[220px] rounded-buzzModal border-[10px] border-buzz-ink bg-buzz-paper shadow-buzzLg">
      <div className="relative overflow-hidden rounded-buzzCard bg-buzz-paper">
        <div className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-buzz-ink" />
        <div className="min-h-[420px]">{children}</div>
      </div>
    </div>
  );
}
