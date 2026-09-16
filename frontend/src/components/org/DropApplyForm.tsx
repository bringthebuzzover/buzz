/**
 * Active-org Apply (optional pitch). Shared by `/org/browse` and `/d/:id`.
 */
import { useState } from "react";
import { useApplyToDrop } from "../../api/hooks/useDropHooks";
import { Card } from "../ui/Card";
import { Button, ErrorBanner, TextArea } from "../forms/controls";
import { GAP, STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function DropApplyForm({
  dropId,
  onCancel,
  onSuccess,
}: {
  dropId: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const mutation = useApplyToDrop(dropId);
  const [pitch, setPitch] = useState("");

  const handleSubmit = () => {
    void mutation.mutateAsync(pitch || undefined).then(() => onSuccess?.());
  };

  return (
    <Card kind="card" pad="roomy" className="mx-auto max-w-md">
      <h2 className={cn(TEXT.h2, "mb-4")}>Apply to Drop</h2>
      <div className={STACK.default}>
        <TextArea
          placeholder="Optional pitch message..."
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          rows={4}
        />
        <div className={cn("flex", GAP.tight)}>
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            data-testid="apply-submit"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1"
          >
            {mutation.isPending ? "Submitting..." : "Submit"}
          </Button>
        </div>
        {mutation.error ? (
          <ErrorBanner>
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Failed to apply."}
          </ErrorBanner>
        ) : null}
      </div>
    </Card>
  );
}
