/**
 * /creators/profile — what Buzz and brands see about the creator.
 */
import { useState, type FormEvent } from "react";
import {
  creatorCompleteness,
  useAddPortfolioItem,
  useCreatorProfile,
} from "../../api/hooks/creator/useCreatorHooks";
import { CompletenessBar, ConnectedStats, PortfolioGrid } from "../../components/creator/ProfileBits";
import { Button, TextField } from "../../components/forms/controls";
import PageShell from "../../components/site/PageShell";
import { Card } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function CreatorProfilePage() {
  const { data: profile } = useCreatorProfile();
  if (!profile) return null;

  return (
    <PageShell width="form">
      <h1 className={cn(TEXT.h1, "mb-1 text-buzz-ink")}>{profile.name}</h1>
      <p className={cn(TEXT.body, "mb-6 text-buzz-inkMuted")}>
        {[profile.school, profile.city, profile.gradYear && `Class of ${profile.gradYear}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <CompletenessBar score={creatorCompleteness(profile)} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={cn(TEXT.h3, "text-buzz-ink")}>{profile.claimedHandle}</h2>
          <Chip tone={profile.instagramConnected ? "success" : "warn"}>
            {profile.instagramConnected ? "Instagram connected" : "Not connected"}
          </Chip>
        </div>
        <ConnectedStats followers={profile.followers} posts={profile.posts} />
        {profile.tiktokHandle ? (
          <p className={cn(TEXT.meta, "mt-4")}>
            TikTok {profile.tiktokHandle} · added by you, not connected
          </p>
        ) : null}
      </Card>

      <Card className="mb-6">
        {profile.bio ? <p className={cn(TEXT.body, "mb-4")}>{profile.bio}</p> : null}
        <Facet label="Niches" values={profile.niches} />
        <Facet label="Open to" values={profile.openTo} />
        {profile.pastCollab ? (
          <p className={cn(TEXT.meta, "mt-3")}>Past collaboration: {profile.pastCollab}</p>
        ) : null}
      </Card>

      <Card>
        <h2 className={cn(TEXT.h3, "mb-3 text-buzz-ink")}>Portfolio</h2>
        <PortfolioGrid items={profile.portfolio} />
        <AddPortfolioItem />
      </Card>
    </PageShell>
  );
}

function Facet({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="mt-3">
      <p className={cn(TEXT.meta, "mb-1")}>{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <Chip key={value}>{value}</Chip>
        ))}
      </div>
    </div>
  );
}

function AddPortfolioItem() {
  const addItem = useAddPortfolioItem();
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    addItem.mutate(title.trim(), link.trim());
    setTitle("");
    setLink("");
  }

  return (
    <form onSubmit={onSubmit} className="mt-6">
      <h3 className={cn(TEXT.body, "mb-2 font-semibold text-buzz-ink")}>Add past work</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="portfolio-title"
          label="Title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField
          id="portfolio-link"
          type="url"
          label="Link (optional)"
          placeholder="https://"
          value={link}
          onChange={(event) => setLink(event.target.value)}
        />
      </div>
      <div className="mt-3">
        <Button type="submit" variant="outline" disabled={!title.trim() || addItem.isPending}>
          Add to portfolio
        </Button>
      </div>
    </form>
  );
}
