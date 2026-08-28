/**
 * Stylized product chrome for public role tours. Fictional content only —
 * not a live portal screenshot (spa.for-orgs-for-brands).
 */
import type { ReactNode } from "react";

type TourFrameProps = {
  url: string;
  caption: string;
  children: ReactNode;
};

export default function TourFrame({ url, caption, children }: TourFrameProps) {
  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-2xl border border-buzz-lineMid bg-buzz-paper shadow-sm">
        <div className="flex items-center gap-2 border-b border-buzz-lineMid bg-buzz-cream px-3 py-2">
          <span className="flex gap-1" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-buzz-lineMid" />
            <span className="h-2.5 w-2.5 rounded-full bg-buzz-lineMid" />
            <span className="h-2.5 w-2.5 rounded-full bg-buzz-lineMid" />
          </span>
          <p className="min-w-0 truncate font-mono text-[11px] font-medium text-buzz-inkMuted">
            {url}
          </p>
        </div>
        <div className="bg-buzz-cream p-4 sm:p-5">{children}</div>
      </div>
      <figcaption className="mt-2 text-center text-xs font-medium text-buzz-inkMuted">
        {caption}
      </figcaption>
    </figure>
  );
}
