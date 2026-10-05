/**
 * /creators/feed — Digital Drops open to creators. Active creators only.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useApplyToCreatorDrop,
  useCreatorCampaigns,
  useCreatorDrops,
} from "../../api/hooks/creator/useCreatorHooks";
import type { CreatorDrop } from "../../api/hooks/creator/types";
import { CreatorDropCard } from "../../components/creator/CreatorDropCard";
import { Button, TextArea } from "../../components/forms/controls";
import PageShell from "../../components/site/PageShell";
import { Card } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function CreatorFeedPage() {
  const { data: drops } = useCreatorDrops();
  const { data: campaigns } = useCreatorCampaigns();
  const appliedDropIds = new Set(campaigns.map((row) => row.drop.id));

  return (
    <PageShell>
      <h1 className={cn(TEXT.h1, "mb-2 text-buzz-ink")}>Browse Campaigns</h1>
      <p className={cn(TEXT.body, "mb-6 max-w-prose text-buzz-inkMuted")}>
        Digital Drops for individual creators. Nothing ships; you post from your
        own Instagram. Buzz introduces you to the brand.
      </p>
      {drops.length === 0 ? (
        <Card>
          <p className={TEXT.body}>No Drops are open to creators right now.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {drops.map((drop) => (
            <CreatorDropCard key={drop.id} drop={drop}>
              <DropAction drop={drop} applied={appliedDropIds.has(drop.id)} />
            </CreatorDropCard>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function DropAction({ drop, applied }: { drop: CreatorDrop; applied: boolean }) {
  const applyToDrop = useApplyToCreatorDrop();
  const [open, setOpen] = useState(false);
  const [pitch, setPitch] = useState("");
  const pitchId = `pitch-${drop.id}`;

  if (applied) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Chip tone="success">Applied</Chip>
        <Link to="/creators/campaigns" className="text-sm font-medium text-buzz-coral hover:underline">
          My Campaigns
        </Link>
      </div>
    );
  }
  if (drop.status === "upcoming") {
    return <p className={TEXT.meta}>Applications open soon.</p>;
  }
  if (drop.status === "closed") {
    return <p className={TEXT.meta}>Applications are closed.</p>;
  }
  if (!open) {
    return (
      <Button type="button" fullWidth onClick={() => setOpen(true)}>
        Apply
      </Button>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!pitch.trim()) return;
        applyToDrop.mutate(drop.id, pitch.trim());
      }}
    >
      <TextArea
        id={pitchId}
        label="Your pitch"
        placeholder="What would you post, and why does it fit your audience?"
        required
        value={pitch}
        onChange={(event) => setPitch(event.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" disabled={!pitch.trim() || applyToDrop.isPending}>
          Submit application
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
