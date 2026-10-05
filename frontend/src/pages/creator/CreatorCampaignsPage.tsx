/**
 * /creators/campaigns — the creator's applications, post linking, and fees.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Clapperboard, Image as ImageIcon } from "lucide-react";
import {
  useCreatorCampaigns,
  useCreatorEarnings,
  useCreatorPosts,
  useCreatorProfile,
  useLinkCreatorPost,
} from "../../api/hooks/creator/useCreatorHooks";
import type { CreatorApplication, CreatorCampaign } from "../../api/hooks/creator/types";
import { siteIdentity } from "../../data/siteIdentity";
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

  return (
    <PageShell width="form">
      <h1 className={cn(TEXT.h1, "mb-2 text-buzz-ink")}>My Campaigns</h1>
      <p className={cn(TEXT.body, "mb-6 text-buzz-inkMuted")}>
        Digital Drops. No product to wait on.
      </p>
      <EarningsCard />
      {profile ? (
        <InstagramStrip
          handle={profile.claimedHandle}
          followers={profile.followers}
          posts={profile.posts}
        />
      ) : null}

      <h2 className={cn(TEXT.h2, "mb-4 mt-10 text-buzz-ink")}>Your Drops</h2>
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

function EarningsCard() {
  const { data: earnings } = useCreatorEarnings();
  const paidShare =
    earnings.yearToDate > 0 ? (earnings.paid / earnings.yearToDate) * 100 : 0;
  return (
    <section
      aria-labelledby="creator-earnings"
      className="rounded-buzzCard bg-gradient-to-br from-buzz-coral to-buzz-coralLight p-6 text-buzz-paper shadow-buzz"
    >
      <p id="creator-earnings" className={cn(TEXT.micro, "font-semibold tracking-wide opacity-90")}>
        Earned this year
      </p>
      <p className="mt-1 text-5xl font-semibold tabular-nums tracking-tight">
        {money(earnings.yearToDate)}
      </p>
      {earnings.yearToDate > 0 ? (
        <>
          <div className="mt-5 flex h-2.5 gap-1 overflow-hidden rounded-full" aria-hidden>
            {earnings.paid > 0 ? (
              <div className="h-full rounded-full bg-buzz-paper" style={{ width: `${paidShare}%` }} />
            ) : null}
            {earnings.pending > 0 ? (
              <div className="h-full flex-1 rounded-full bg-buzz-paper/50" />
            ) : null}
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-buzz-paper" aria-hidden />
              <dt>Paid</dt>
              <dd className="font-semibold tabular-nums">{money(earnings.paid)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-buzz-paper/50" aria-hidden />
              <dt>On its way</dt>
              <dd className="font-semibold tabular-nums">{money(earnings.pending)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="mt-3 text-sm opacity-90">
          Get selected for a Drop and your fee shows up here.
        </p>
      )}
    </section>
  );
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function InstagramStrip({
  handle,
  followers,
  posts,
}: {
  handle: string;
  followers: number | null;
  posts: number | null;
}) {
  return (
    <Link
      to="/creators/profile"
      className="mt-4 flex items-center gap-3 rounded-buzzCard border border-buzz-lineMid bg-buzz-paper px-4 py-3 transition hover:border-buzz-coral"
    >
      <img src={siteIdentity.images.socialInstagramIcon} alt="" className="h-5 w-5" />
      <span className={cn(TEXT.body, "font-semibold text-buzz-ink")}>{handle}</span>
      {followers !== null ? (
        <span className={cn(TEXT.body, "ml-auto whitespace-nowrap text-buzz-inkMuted")}>
          <span className="font-semibold text-buzz-ink">{compact.format(followers)}</span> followers
          {posts !== null ? (
            <span className="hidden sm:inline">
              {" · "}
              <span className="font-semibold text-buzz-ink">{posts}</span> posts
            </span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}

const STEPS = ["Applied", "Selected", "Post linked", "Approved", "Paid"] as const;

function stepIndex(application: CreatorApplication): number {
  if (application.payout === "recorded") return 4;
  if (application.content === "accepted") return 3;
  if (application.content === "in_review") return 2;
  if (application.decision === "accepted") return 1;
  return 0;
}

function ProgressSteps({ current }: { current: number }) {
  return (
    <ol className="mt-5 flex items-start" aria-label="Progress">
      {STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <li
            key={step}
            aria-current={i === current ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center text-center"
          >
            {i > 0 ? (
              <span
                className={cn(
                  "absolute right-1/2 top-[7px] h-0.5 w-full",
                  done ? "bg-buzz-coral" : "bg-buzz-lineMid",
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative h-4 w-4 rounded-full border-2",
                done ? "border-buzz-coral bg-buzz-coral" : "border-buzz-lineMid bg-buzz-paper",
                i === current && "ring-4 ring-buzz-coral/20",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "mt-2 text-xs",
                done ? "font-semibold text-buzz-ink" : "text-buzz-inkFaint",
              )}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CampaignCard({ campaign }: { campaign: CreatorCampaign }) {
  const { application, drop, linkedPost } = campaign;
  const { label, tone } = stage(application);
  const denied = application.decision === "denied";
  return (
    <Card pad="none" className="overflow-hidden">
      {drop.imageUrl ? (
        <img src={drop.imageUrl} alt="" className="h-32 w-full object-cover" />
      ) : (
        <div className="h-32 bg-buzz-butter" aria-hidden />
      )}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={cn(TEXT.micro, "font-semibold text-buzz-coral")}>{drop.brandName}</p>
            <h3 className={cn(TEXT.h3, "mt-1 text-buzz-ink")}>{drop.title}</h3>
          </div>
          <div className="text-right">
            <p className={cn(TEXT.metric, "text-buzz-ink")}>{money(drop.creatorGross)}</p>
            <p className={TEXT.meta}>your fee</p>
          </div>
        </div>
        {denied ? (
          <div className="mt-4">
            <Chip tone={tone}>{label}</Chip>
          </div>
        ) : (
          <ProgressSteps current={stepIndex(application)} />
        )}
        <p className={cn(TEXT.body, "mt-5 text-buzz-inkMuted")}>“{application.pitch}”</p>
        {linkedPost ? (
          <p className={cn(TEXT.body, "mt-3 text-buzz-ink")}>
            Linked {linkedPost.format}: <span className="font-semibold">{linkedPost.caption}</span>
          </p>
        ) : null}
        {application.decision === "accepted" && application.content === "none" ? (
          <PostPicker applicationId={application.id} />
        ) : null}
        <p className={cn(TEXT.meta, "mt-5")}>
          You keep the full fee; Buzz bills its fee to the brand. Usage rights for
          your post are still being decided.
        </p>
      </div>
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
    <fieldset className="mt-5 rounded-buzzCard bg-buzz-cream p-4">
      <legend className="sr-only">Choose the post you made</legend>
      <p className={cn(TEXT.h3, "text-buzz-ink")} aria-hidden>
        Choose the post you made
      </p>
      <p className={cn(TEXT.meta, "mb-3 mt-1")}>Recent posts from your Instagram.</p>
      <div className="grid grid-cols-2 gap-3">
        {posts.map((post) => {
          const selected = postId === post.id;
          const FormatIcon = post.format === "Reel" ? Clapperboard : ImageIcon;
          return (
            <button
              key={post.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setPostId(post.id)}
              className={cn(
                "overflow-hidden rounded-buzzCard border-2 bg-buzz-paper text-left transition",
                selected
                  ? "border-buzz-coral shadow-buzz"
                  : "border-transparent hover:border-buzz-lineMid",
              )}
            >
              <span
                className="relative flex aspect-[4/3] items-end bg-gradient-to-br from-buzz-spectrumStart via-buzz-spectrumMid to-buzz-spectrumEnd p-3"
                aria-hidden
              >
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-buzz-dark/50 px-2 py-0.5 text-xs font-semibold text-buzz-paper">
                  <FormatIcon size={12} />
                  {post.format}
                </span>
                {selected ? (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-buzz-coral text-buzz-paper">
                    <Check size={14} strokeWidth={3} />
                  </span>
                ) : null}
              </span>
              <span className="block p-3">
                <span className="line-clamp-2 text-sm font-semibold text-buzz-ink">
                  {post.caption}
                </span>
                <span className="mt-1 block text-xs text-buzz-inkMuted">
                  {postedOn.format(new Date(`${post.postedAt}T12:00:00`))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
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

const postedOn = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

const money = (amount: number) => `$${amount.toLocaleString("en-US")}`;
