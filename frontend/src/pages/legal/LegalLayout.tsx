/**
 * Shared shell for the static legal pages: kicker, title, contents column,
 * and the article. Body copy stays in the page files.
 */
import { useEffect, useState, type ReactNode } from "react";
import { focusRingClass } from "../../theme/controls";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export type LegalTocItem = { id: string; label: string };

export default function LegalLayout({
  title,
  lastUpdated,
  toc,
  children,
}: {
  title: string;
  lastUpdated: string;
  toc: LegalTocItem[];
  children: ReactNode;
}) {
  const [active, setActive] = useState(toc[0]?.id ?? "");
  const ids = toc.map((item) => item.id).join("|");

  useEffect(() => {
    const nodes = ids
      .split("|")
      .filter(Boolean)
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.4] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [ids]);

  return (
    <div className="mx-auto w-full max-w-[1116px] px-6 py-16 lg:px-12">
      <p className="text-xs font-medium text-accent">Legal</p>
      <h1 className={cn(TEXT.title, "mt-3 text-primary")}>{title}</h1>
      <p className="mt-3 text-sm text-quiet">Last updated: {lastUpdated}</p>

      <div className="mt-16 flex flex-col gap-12 lg:mt-24 lg:flex-row lg:items-start lg:gap-16">
        <nav
          aria-label="On this page"
          className="lg:sticky lg:top-28 lg:w-[260px] lg:shrink-0"
        >
          <p className="mb-4 text-sm font-medium text-primary">On this page</p>
          <ul className="space-y-3">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={cn(
                    "text-sm text-muted hover:text-primary",
                    focusRingClass,
                    active === item.id && "text-primary",
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article
          className={cn(
            "min-w-0 flex-1 space-y-6 text-base leading-relaxed text-muted lg:max-w-[760px]",
            "[&>p:first-child]:text-primary",
            "[&_h2]:scroll-mt-28 [&_h2]:border-t [&_h2]:border-line [&_h2]:pt-8 [&_h2]:font-medium [&_h2]:text-primary [&_h2]:text-buzzH3",
            "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
            "[&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-buzz-yellow [&_a]:focus-visible:ring-offset-2 [&_a]:focus-visible:ring-offset-page",
            "[&_ul]:list-none [&_ul]:space-y-2 [&_ul]:pl-0",
            "[&_ul>li]:relative [&_ul>li]:pl-5",
            "[&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-2 [&_ul>li]:before:h-1.5 [&_ul>li]:before:w-1.5 [&_ul>li]:before:rounded-full [&_ul>li]:before:bg-accent [&_ul>li]:before:content-['']",
            "[&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ol]:marker:text-accent",
            "[&_code]:text-primary",
          )}
        >
          {children}
        </article>
      </div>
    </div>
  );
}
