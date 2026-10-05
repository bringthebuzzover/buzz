import type { ReactNode } from "react";
import type { CreatorDrop } from "../../api/hooks/creator/types";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const STATUS_LABEL = { upcoming: "Upcoming", open: "Open", closed: "Closed" } as const;
const STATUS_TONE = { upcoming: "warn", open: "success", closed: "neutral" } as const;

export function seatsLabel(drop: CreatorDrop) {
  const left = Math.max(0, drop.creatorCap - drop.acceptedCount);
  return `${left} of ${drop.creatorCap} creator seats left`;
}

export function CreatorDropCard({
  drop,
  children,
}: {
  drop: CreatorDrop;
  children?: ReactNode;
}) {
  return (
    <Card kind="cardWarm" pad="none" className="overflow-hidden">
      <div className="relative h-40 overflow-hidden border-b border-buzz-lineMid bg-buzz-butter">
        {drop.imageUrl ? (
          <img src={drop.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Chip accent>{drop.brandName}</Chip>
          <Chip tone={STATUS_TONE[drop.status]}>{STATUS_LABEL[drop.status]}</Chip>
        </div>
      </div>
      <div className="p-4">
        <h2 className={cn(TEXT.h3, "text-buzz-coral")}>{drop.title}</h2>
        <p className={cn(TEXT.body, "mt-2 text-buzz-inkMuted")}>{drop.description}</p>
        <p className={cn(TEXT.meta, "mt-2")}>
          Digital · {seatsLabel(drop)} · ${drop.creatorGross} per creator
        </p>
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </Card>
  );
}
