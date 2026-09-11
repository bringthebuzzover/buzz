/**
 * Shared shell for the static legal pages (Privacy Policy, Terms of Service):
 * constrained prose column with a title and "last updated" line.
 */
import type { ReactNode } from "react";
import PageShell from "../../components/site/PageShell";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <PageShell width="reading">
      <h1 className={cn(TEXT.h1, "mb-2")}>{title}</h1>
      <p className="mb-10 text-sm font-medium text-buzz-inkMuted">
        Last updated: {lastUpdated}
      </p>
      <div className="space-y-6 text-sm leading-relaxed text-buzz-ink [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-buzz-ink [&_a]:text-buzz-coral [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {children}
      </div>
    </PageShell>
  );
}
