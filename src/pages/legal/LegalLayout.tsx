/**
 * Shared shell for the static legal pages (Privacy Policy, Terms of Service):
 * constrained prose column with a title and "last updated" line.
 */
import type { ReactNode } from "react";

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
    <section className="mx-auto max-w-3xl px-8 py-16">
      <h1 className="mb-2 text-4xl font-black text-buzz-coral">{title}</h1>
      <p className="mb-10 text-sm font-medium text-buzz-inkMuted">
        Last updated: {lastUpdated}
      </p>
      <div className="space-y-6 text-sm leading-relaxed text-buzz-ink [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-buzz-ink [&_a]:text-buzz-coral [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {children}
      </div>
    </section>
  );
}
