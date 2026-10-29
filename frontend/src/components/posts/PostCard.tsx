/**
 * Pen `Post / Card`: thumbnail (or the image-off placeholder), caption, a
 * likes line, then the Instagram insights grid. `aside` holds the row action.
 * Shared by the org post picker and the brand drop post list.
 */
import type { ReactNode } from "react";
import PostInsights from "./PostInsights";
import type { InsightSource } from "./postInsights";
import { RemoteImage } from "../ui/RemoteImage";
import { PAD, SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function PostCard({
  post,
  thumb,
  caption,
  meta,
  aside,
}: {
  post: InsightSource;
  thumb: string | null | undefined;
  caption: ReactNode;
  meta: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <li className={cn(SURFACE.tile, PAD.default, "flex flex-wrap items-start gap-4")}>
      <RemoteImage
        src={thumb}
        label="Post"
        alt=""
        fallback="placeholder"
        className="h-[120px] w-24 shrink-0 rounded-buzzCard object-cover"
      />
      <div className="min-w-0 flex-1 basis-56">
        <div className={cn(TEXT.body, "line-clamp-2 font-medium text-primary")}>
          {caption}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-quiet">{meta}</p>
        <PostInsights post={post} />
      </div>
      {aside}
    </li>
  );
}
