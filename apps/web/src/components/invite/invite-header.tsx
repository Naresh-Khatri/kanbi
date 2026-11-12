import { PlusIcon } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { DEFAULT_PROJECT_COLOR } from "@/lib/palette";
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
    // project colour is db data -> inline style; text-white sits on it
    <span
      className="flex shrink-0 items-center justify-center rounded-lg font-semibold text-white shadow-xs/5 inset-ring inset-ring-black/10"
      style={{
        background: color ?? DEFAULT_PROJECT_COLOR,
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
          className="ring-2 ring-background"
          image={invite.inviterImage}
          name={invite.inviterName}
          size={size}
        />
        <PlusIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <ProjectTile
          color={invite.projectColor}
          name={invite.projectName}
          size={size}
        />
      </div>
      <p
        className={cn(
          "text-muted-foreground",
          compact ? "text-sm" : "text-balance font-heading text-lg leading-snug",
        )}
      >
        <span className="font-semibold text-foreground">
          {invite.inviterName}
        </span>{" "}
        invited you to join{" "}
        <span className="font-semibold text-foreground">
          {invite.projectName}
        </span>
      </p>
    </div>
  );
}
