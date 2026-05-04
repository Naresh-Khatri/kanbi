import {
  AlertTriangle,
  type LucideIcon,
  MinusCircle,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from "lucide-react";

export const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; Icon: LucideIcon }
> = {
  urgent: { label: "Urgent", color: "#f43f5e", Icon: AlertTriangle },
  high: { label: "High", color: "#f59e0b", Icon: SignalHigh },
  medium: { label: "Medium", color: "#eab308", Icon: SignalMedium },
  low: { label: "Low", color: "#3b82f6", Icon: SignalLow },
  none: { label: "No priority", color: "#71717a", Icon: MinusCircle },
};

export function PriorityIcon({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const { Icon, color } = PRIORITY_META[priority];
  return <Icon className={className} style={{ color }} />;
}
