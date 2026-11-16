import type { Release } from "@/changelog";
import { cn } from "@/lib/utils";

export function ReleaseVideo({
  video,
  className,
}: {
  video: NonNullable<Release["video"]>;
  className?: string;
}) {
  return (
    // aspect-video reserves the box before metadata loads -> no layout shift
    <video
      className={cn(
        "aspect-video w-full rounded-lg border bg-black object-contain",
        className,
      )}
      controls
      playsInline
      poster={video.poster}
      preload="none"
      src={video.src}
    />
  );
}
