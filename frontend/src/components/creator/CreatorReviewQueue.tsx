/**
 * Admin queues for creators: profile review, then payouts Buzz records by
 * hand. Mounted in the admin console once creator review ships.
 */
import {
  useCreatorPayoutQueue,
  useCreatorReviewQueue,
  useRecordCreatorPayout,
  useReviewCreator,
} from "../../api/hooks/creator/useCreatorHooks";
import { Button } from "../forms/controls";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export function CreatorReviewQueue() {
  const { data: queue } = useCreatorReviewQueue();
  const review = useReviewCreator();

  return (
    <section aria-labelledby="creator-review-heading">
      <h2 id="creator-review-heading" className={cn(TEXT.h2, "mb-2 text-buzz-ink")}>
        Creator review
      </h2>
      <p className={cn(TEXT.body, "mb-4 max-w-prose text-buzz-inkMuted")}>
        Approving lets the creator connect Instagram and apply to Drops.
      </p>
      {queue.length === 0 ? (
        <Card>
          <p className={TEXT.body}>No creators waiting for review.</p>
        </Card>
      ) : (
        <ul className="grid gap-4">
          {queue.map((creator) => (
            <li key={creator.id}>
              <Card>
                <Chip tone="warn">Pending review</Chip>
                <h3 className={cn(TEXT.h3, "mt-3 text-buzz-ink")}>{creator.name}</h3>
                <p className={cn(TEXT.body, "mt-1 text-buzz-inkMuted")}>
                  {creator.school} · {creator.eduEmail} · {creator.claimedHandle}
                </p>
                <p className={cn(TEXT.meta, "mt-1")}>{creator.niches.join(", ")}</p>
                {creator.bio ? <p className={cn(TEXT.body, "mt-3")}>{creator.bio}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    aria-label={`Approve ${creator.name}`}
                    disabled={review.isPending}
                    onClick={() => review.mutate(creator.id, true)}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    aria-label={`Deny ${creator.name}`}
                    disabled={review.isPending}
                    onClick={() => review.mutate(creator.id, false)}
                  >
                    Deny
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CreatorPayoutQueue() {
  const { data: queue } = useCreatorPayoutQueue();
  const record = useRecordCreatorPayout();

  return (
    <section aria-labelledby="creator-payout-heading">
      <h2 id="creator-payout-heading" className={cn(TEXT.h2, "mb-2 text-buzz-ink")}>
        Creator payouts
      </h2>
      <p className={cn(TEXT.body, "mb-4 max-w-prose text-buzz-inkMuted")}>
        Accepted posts waiting on payment. Record each one after Buzz sends the fee.
      </p>
      {queue.length === 0 ? (
        <Card>
          <p className={TEXT.body}>No payouts to record.</p>
        </Card>
      ) : (
        <ul className="grid gap-4">
          {queue.map(({ application, creator, drop }) => (
            <li key={application.id}>
              <Card kind="cardFlat">
                <h3 className={cn(TEXT.h3, "text-buzz-ink")}>{creator.name}</h3>
                <p className={cn(TEXT.body, "mt-1 text-buzz-inkMuted")}>
                  {drop.brandName} · {drop.title} · ${drop.creatorGross}
                </p>
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={record.isPending}
                    onClick={() => record.mutate(application.id)}
                  >
                    Record payout
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
