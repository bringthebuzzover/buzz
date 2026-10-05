/**
 * Brand view of creator applicants on one Digital Drop: filter, batch
 * finalize after the apply window closes, and accept linked posts. Mounted on
 * the brand Drop page once creator Drops ship.
 */
import { useState } from "react";
import {
  useAcceptCreatorPost,
  useCreatorDrop,
  useCreatorRoster,
  useFinalizeCreatorRoster,
} from "../../api/hooks/creator/useCreatorHooks";
import type { CreatorRosterRow } from "../../api/hooks/creator/types";
import { Checkbox } from "../forms/Checkbox";
import { Button } from "../forms/controls";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import { ChoiceChips } from "./ChoiceChips";
import { seatsLabel } from "./CreatorDropCard";

const ALL = "All";

const DECISION = {
  applied: { label: "Applied", tone: "warn" },
  accepted: { label: "Accepted", tone: "success" },
  denied: { label: "Not selected", tone: "danger" },
} as const;

export default function CreatorRosterSection({ dropId }: { dropId: string }) {
  const { data: drop } = useCreatorDrop(dropId);
  const { data: roster } = useCreatorRoster(dropId);
  const finalize = useFinalizeCreatorRoster();
  const [school, setSchool] = useState(ALL);
  const [niche, setNiche] = useState(ALL);
  const [picked, setPicked] = useState<string[]>([]);

  if (!drop) return null;

  const seatsLeft = Math.max(0, drop.creatorCap - drop.acceptedCount);
  const canFinalize = !drop.windowOpen && roster.some((row) => row.application.decision === "applied");
  const schools = [ALL, ...new Set(roster.map((row) => row.creator.school))];
  const niches = [ALL, ...new Set(roster.flatMap((row) => row.creator.niches))];
  const rows = roster
    .filter((row) => school === ALL || row.creator.school === school)
    .filter((row) => niche === ALL || row.creator.niches.includes(niche));

  const togglePick = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  return (
    <section aria-labelledby="creator-roster-heading">
      <h2 id="creator-roster-heading" className={cn(TEXT.h2, "mb-2 text-buzz-ink")}>
        Creators
      </h2>
      <p className={cn(TEXT.body, "mb-4 text-buzz-inkMuted")}>{seatsLabel(drop)}.</p>

      <Card className="mb-6">
        <p className={TEXT.body}>
          Each creator receives ${drop.creatorGross}. Buzz&apos;s fee is $
          {drop.buzzFee}, so each creator costs you ${drop.brandTotal}.
        </p>
        <p className={cn(TEXT.meta, "mt-2")}>
          {drop.windowOpen
            ? "Applications are open. You choose creators after the window closes."
            : canFinalize
              ? `Select up to ${seatsLeft} creators, then finalize. Everyone you leave unselected is told they were not chosen.`
              : "Roster finalized."}
        </p>
      </Card>

      {roster.length === 0 ? (
        <Card>
          <p className={TEXT.body}>No creators have applied yet.</p>
        </Card>
      ) : (
        <>
          <div className="mb-3">
            <ChoiceChips
              label="Filter by school"
              options={schools}
              selected={[school]}
              onToggle={setSchool}
            />
          </div>
          <div className="mb-6">
            <ChoiceChips
              label="Filter by niche"
              options={niches}
              selected={[niche]}
              onToggle={setNiche}
            />
          </div>
          <ul className="grid gap-4">
            {rows.map((row) => (
              <li key={row.application.id}>
                <RosterCard
                  row={row}
                  selectable={canFinalize && row.application.decision === "applied"}
                  selected={picked.includes(row.application.id)}
                  selectDisabled={
                    !picked.includes(row.application.id) && picked.length >= seatsLeft
                  }
                  onToggle={() => togglePick(row.application.id)}
                />
              </li>
            ))}
          </ul>
          {canFinalize ? (
            <div className="mt-6">
              <Button
                type="button"
                disabled={finalize.isPending}
                onClick={() => {
                  finalize.mutate(dropId, picked);
                  setPicked([]);
                }}
              >
                Finalize roster ({picked.length} of {seatsLeft})
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function RosterCard({
  row,
  selectable,
  selected,
  selectDisabled,
  onToggle,
}: {
  row: CreatorRosterRow;
  selectable: boolean;
  selected: boolean;
  selectDisabled: boolean;
  onToggle: () => void;
}) {
  const acceptPost = useAcceptCreatorPost();
  const { application, creator, linkedPost } = row;
  const decision = DECISION[application.decision];

  return (
    <Card kind="cardFlat">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={cn(TEXT.h3, "text-buzz-ink")}>{creator.name}</h3>
        <Chip tone={decision.tone}>{decision.label}</Chip>
      </div>
      <p className={cn(TEXT.body, "mt-1 text-buzz-inkMuted")}>
        {creator.school} · {creator.claimedHandle}
        {creator.followers !== null
          ? ` · ${creator.followers.toLocaleString("en-US")} followers from Instagram`
          : ""}
      </p>
      <p className={cn(TEXT.meta, "mt-1")}>
        {creator.niches.join(", ")}
        {creator.pastCollab ? ` · Past collaboration: ${creator.pastCollab}` : ""}
      </p>
      <p className={cn(TEXT.body, "mt-3")}>{application.pitch}</p>
      {selectable ? (
        <div className="mt-4">
          <Checkbox
            label={`Select ${creator.name}`}
            checked={selected}
            disabled={selectDisabled}
            onChange={onToggle}
          />
        </div>
      ) : null}
      {linkedPost ? (
        <p className={cn(TEXT.body, "mt-4")}>
          Linked {linkedPost.format}: “{linkedPost.caption}”
        </p>
      ) : null}
      {application.content === "in_review" ? (
        <div className="mt-3">
          <Button
            type="button"
            disabled={acceptPost.isPending}
            onClick={() => acceptPost.mutate(application.id)}
          >
            Accept post
          </Button>
        </div>
      ) : null}
      {application.content === "accepted" ? (
        <p className={cn(TEXT.meta, "mt-3")}>Post accepted.</p>
      ) : null}
    </Card>
  );
}
