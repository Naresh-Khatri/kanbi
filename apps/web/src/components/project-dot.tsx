import { DEFAULT_PROJECT_COLOR } from "@/lib/palette";
import { cn } from "@/lib/utils";

// project color is db data -> inline style
export function ProjectDot({
  color,
  className,
}: {
  color: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color ?? DEFAULT_PROJECT_COLOR }}
    />
  );
}
