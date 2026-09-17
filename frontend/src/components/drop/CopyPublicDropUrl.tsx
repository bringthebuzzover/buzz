/**
 * Copyable `{origin}/d/{id}` for admin ops paste and brand portal (PRODUCT §6.3.4).
 * Brands get the path as text only — no intent list.
 */
import { useState } from "react";
import { Button } from "../forms/controls";
import { publicDropAbsUrl } from "../../utils/oauthNext";

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
    <div className="flex flex-wrap items-center gap-2">
      <code
        data-testid={`${testId}-value`}
        className="max-w-full truncate rounded-buzzControl border border-buzz-lineMid bg-buzz-cream px-2 py-1 text-xs font-medium text-buzz-ink"
      >
        {url}
      </code>
      <Button
        type="button"
        variant="outline"
        size="compact"
        data-testid={testId}
        onClick={() => void onCopy()}
      >
        {copied ? "Copied" : "Copy public URL"}
      </Button>
    </div>
  );
}
