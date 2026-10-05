/**
 * /creators/campaigns — the creator's applications, post linking, and fees.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useCreatorCampaigns,
  useCreatorEarnings,
  useCreatorPosts,
  useCreatorProfile,
  useLinkCreatorPost,
} from "../../api/hooks/creator/useCreatorHooks";
import type { CreatorApplication, CreatorCampaign } from "../../api/hooks/creator/types";
import { ConnectedStats } from "../../components/creator/ProfileBits";
import { Button } from "../../components/forms/controls";
import PageShell from "../../components/site/PageShell";
import { Card } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { TEXT, type Tone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

function stage(application: CreatorApplication): { label: string; tone: Tone } {
  if (application.decision === "denied") return { label: "Not selected", tone: "danger" };
  if (application.decision === "applied") return { label: "Applied", tone: "warn" };
  if (application.payout === "recorded") return { label: "Paid", tone: "success" };
  if (application.content === "accepted") return { label: "Post accepted", tone: "success" };
  if (application.content === "in_review") return { label: "Post in review", tone: "warn" };
  return { label: "Accepted · link your post", tone: "success" };
}

export default function CreatorCampaignsPage() {
  const { data: profile } = useCreatorProfile();
  const { data: campaigns } = useCreatorCampaigns();
  const { data: earnings } = useCreatorEarnings();
  const activeDeliverables = campaigns.filter(
    ({ application }) =>
      application.decision === "accepted" && application.payout !== "recorded",
  ).length;

  return (
    <PageShell width="form">
      <h1 className={cn(TEXT.h1, "mb-2 text-buzz-ink")}>My Campaigns</h1>
      <p className={cn(TEXT.body, "text-buzz-inkMuted")}>
        Digital Drops. No product to wait on.
      </p>
      <ConnectedStats
        followers={profile?.followers ?? null}
        posts={profile?.posts ?? null}
        activeDeliverables={activeDeliverables}
      />
      <dl className="mb-2 mt-6 grid grid-cols-3 gap-3">
        <Money label="Paid" amount={earnings.paid} />
        <Money label="Pending" amount={earnings.pending} />
        <Money label="Year to date" amount={earnings.yearToDate} />
      </dl>
      <p className={cn(TEXT.meta, "mb-6")}>
        Pending is the fee for work you were accepted for. Paid is what Buzz has
        recorded sending you.
      </p>

      {campaigns.length === 0 ? (
        <Card>
          <p className={TEXT.body}>You haven&apos;t applied to a Drop yet.</p>
          <Link
            to="/creators/feed"
            className="mt-3 inline-block text-sm font-medium text-buzz-coral hover:underline"
          >
            Browse Campaigns
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.application.id} campaign={campaign} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function CampaignCard({ campaign }: { campaign: CreatorCampaign }) {
  const { application, drop, linkedPost } = campaign;
  const { label, tone } = stage(application);
  return (
    <Card>
      <Chip tone={tone}>{label}</Chip>
      <h2 className={cn(TEXT.h3, "mt-3 text-buzz-ink")}>
        {drop.brandName} · {drop.title}
      </h2>
      <p className={cn(TEXT.body, "mt-2 text-buzz-inkMuted")}>{application.pitch}</p>
      <p className={cn(TEXT.metric, "mt-4 text-buzz-ink")}>${drop.creatorGross}</p>
      <p className={TEXT.meta}>
        Your fee, in full. Buzz&apos;s fee is billed to the brand on top. Usage
        rights for your post are still being decided.
      </p>
      {application.decision === "accepted" && application.content === "none" ? (
        <PostPicker applicationId={application.id} />
      ) : null}
      {linkedPost ? (
        <p className={cn(TEXT.body, "mt-4")}>
          Linked {linkedPost.format}: “{linkedPost.caption}”
        </p>
      ) : null}
    </Card>
  );
}

function PostPicker({ applicationId }: { applicationId: string }) {
  const { data: posts } = useCreatorPosts();
  const linkPost = useLinkCreatorPost();
  const [postId, setPostId] = useState<string | null>(null);

  if (posts.length === 0) {
    return (
      <p className={cn(TEXT.body, "mt-4 text-buzz-inkMuted")}>
        No posts from your Instagram yet. Publish the post, then come back to
        link it.
      </p>
    );
  }
  return (
    <fieldset className="mt-4">
      <legend className={cn(TEXT.h3, "mb-2 text-buzz-ink")}>Choose the post you made</legend>
      <div className="grid gap-2">
        {posts.map((post) => (
          <button
            key={post.id}
            type="button"
            aria-pressed={postId === post.id}
            onClick={() => setPostId(post.id)}
            className={cn(
              "rounded-buzzControl border px-3 py-2 text-left text-sm font-medium",
              postId === post.id
                ? "border-buzz-coral bg-buzz-butter text-buzz-ink"
                : "border-buzz-lineMid bg-buzz-paper text-buzz-inkMuted",
            )}
          >
            {post.format} · {post.caption}
            <span className="block text-xs">{post.postedAt}</span>
          </button>
        ))}
      </div>
      <div className="mt-3">
        <Button
          type="button"
          disabled={!postId || linkPost.isPending}
          onClick={() => postId && linkPost.mutate(applicationId, postId)}
        >
          Link this post
        </Button>
      </div>
    </fieldset>
  );
}

function Money({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className={TEXT.meta}>{label}</dt>
      <dd className={cn(TEXT.metric, "text-buzz-ink")}>${amount}</dd>
    </div>
  );
}
