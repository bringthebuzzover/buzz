/**
 * Copyable `{origin}/d/{id}` for admin ops paste and brand portal (PRODUCT §6.3.4).
 * Brands get the path as text only — no intent list. Pen: the URL in a
 * field-style box with a ghost copy button beside it.
 */
import { useState } from "react";
import { Button } from "../forms/controls";
import { publicDropAbsUrl } from "../../utils/oauthNext";
import { SURFACE } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function CopyPublicDropUrl({
  dropId,
  testId = "copy-public-drop-url",
}: {
  dropId: string;
  testId?: string;
}) {
  const url = publicDropAbsUrl(dropId);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <code
        data-testid={`${testId}-value`}
        className={cn(
          SURFACE.inset,
          "flex h-12 min-w-0 flex-1 basis-64 items-center truncate px-4 font-sans text-sm text-muted",
        )}
      >
        {url}
      </code>
      <Button
        type="button"
        variant="ghost"
        data-testid={testId}
        onClick={() => void onCopy()}
      >
        {copied ? "Copied" : "Copy public URL"}
      </Button>
    </div>
  );
}
