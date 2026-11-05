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
    text: "text-danger",
    Icon: AlertTriangle,
  },
  high: {
    label: "High",
    tone: "warning",
    text: "text-warning",
    Icon: SignalHigh,
  },
  // colour fades with priority: low gets none
  medium: {
    label: "Medium",
    tone: "info",
    text: "text-info",
    Icon: SignalMedium,
  },
  low: {
    label: "Low",
    tone: "neutral",
    text: "text-white/70",
    Icon: SignalLow,
  },
  none: {
    label: "No priority",
    tone: "neutral",
    text: "text-white/40",
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
  return <Icon className={cn(text, className)} />;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge tone={PRIORITY_META[priority].tone}>
      <PriorityIcon className="h-3 w-3" priority={priority} />
      {PRIORITY_META[priority].label}
    </Badge>
  );
}

export function PriorityInline({ priority }: { priority: Priority }) {
  const { Icon, text, label } = PRIORITY_META[priority];
  return (
    <span className={cn("inline-flex items-center gap-1", text)}>
      <Icon aria-hidden className="h-3 w-3" />
      {label}
    </span>
  );
}
