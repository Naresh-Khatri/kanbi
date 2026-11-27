import { formatDate } from "@kanbi/shared";

import { targetTone } from "@/lib/milestone";
import { cn } from "@/lib/utils";

export function MilestoneTarget({
  targetAt,
  className,
}: {
  targetAt: Date | string | null;
  className?: string;
}) {
  const tone = targetTone(targetAt);
  if (!targetAt || !tone) return null;
  return (
    <span
      className={cn(
        "tabular-nums",
        tone === "overdue" && "text-destructive-foreground",
        tone === "soon" && "text-warning-foreground",
        tone === "normal" && "text-muted-foreground",
        className,
      )}
    >
      {formatDate(targetAt)}
    </span>
  );
}
