import {
  AlertTriangle,
  type LucideIcon,
  MinusCircle,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_META: Record<
  Priority,
  {
    label: string;
    tone: "danger" | "warning" | "success" | "info" | "neutral";
    text: string;
    Icon: LucideIcon;
  }
> = {
  urgent: {
    label: "Urgent",
    tone: "danger",
    text: "text-destructive-foreground",
    Icon: AlertTriangle,
  },
  high: {
    label: "High",
    tone: "warning",
    text: "text-warning-foreground",
    Icon: SignalHigh,
  },
  // colour fades with priority: low gets none
  medium: {
    label: "Medium",
    tone: "info",
    text: "text-info-foreground",
    Icon: SignalMedium,
  },
  low: {
    label: "Low",
    tone: "neutral",
    text: "text-muted-foreground",
    Icon: SignalLow,
  },
  none: {
    label: "No priority",
    tone: "neutral",
    text: "text-muted-foreground opacity-64",
    Icon: MinusCircle,
  },
};

export function PriorityIcon({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const { Icon, text } = PRIORITY_META[priority];
  return <Icon aria-hidden="true" className={cn(text, className)} />;
}

const BADGE_VARIANT = {
  danger: "error",
  warning: "warning",
  success: "success",
  info: "info",
  neutral: "outline",
} as const;

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { tone, label } = PRIORITY_META[priority];
  return (
    <Badge variant={BADGE_VARIANT[tone]}>
      <PriorityIcon priority={priority} />
      {label}
    </Badge>
  );
}

export function PriorityInline({ priority }: { priority: Priority }) {
  const { Icon, text, label } = PRIORITY_META[priority];
  return (
    <span className={cn("inline-flex items-center gap-1", text)}>
      <Icon aria-hidden="true" className="size-3" />
      {label}
    </span>
  );
}
