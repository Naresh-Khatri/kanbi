import { Plus } from "lucide-react";

import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

export type InviteSummary = {
  projectName: string;
  projectColor: string | null;
  inviterName: string;
  inviterImage: string | null;
};

export function ProjectTile({
  name,
  color,
  size = 40,
}: {
  name: string;
  color: string | null;
  size?: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]"
      style={{
        background: color ?? "#6366f1",
        width: size,
        height: size,
        fontSize: size * 0.42,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** inviter avatar + project tile + "X invited you to join Y". */
export function InviteHeader({
  invite,
  compact,
}: {
  invite: InviteSummary;
  compact?: boolean;
}) {
  const size = compact ? 32 : 48;
  return (
    <div
      className={cn(
        "flex flex-col",
        compact ? "gap-3" : "items-center gap-4 text-center",
      )}
    >
      <div className="flex items-center gap-2">
        <UserAvatar
          className="ring-2 ring-[#111118]"
          image={invite.inviterImage}
          name={invite.inviterName}
          size={size}
        />
        <Plus className="h-3.5 w-3.5 text-white/30" />
        <ProjectTile
          color={invite.projectColor}
          name={invite.projectName}
          size={size}
        />
      </div>
      <p
        className={cn(
          "text-white/70",
          compact ? "text-sm" : "text-lg leading-snug",
        )}
      >
        <span className="font-semibold text-white">{invite.inviterName}</span>{" "}
        invited you to join{" "}
        <span className="font-semibold text-white">{invite.projectName}</span>
      </p>
    </div>
  );
}
