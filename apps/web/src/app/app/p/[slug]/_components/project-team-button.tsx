"use client";

import { ChevronDownIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type Role = "owner" | "editor" | "viewer";

const ROLE_RANK: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };

const ROLE_BADGE = {
  owner: "outline",
  editor: "info",
  viewer: "secondary",
} as const satisfies Record<Role, "outline" | "info" | "secondary">;

// avatar stack = trigger; popover lists members w/ live presence + invites
export function ProjectTeamButton() {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const project = api.project.bySlug.useQuery({ slug }).data;
  const board = api.board.get.useQuery(
    { boardId: project?.boardId ?? "" },
    { enabled: !!project?.boardId },
  ).data;
  const me = api.user.me.useQuery().data;

  const members =
    api.project.members.useQuery(
      { projectId: project?.id ?? "" },
      { enabled: !!project?.id },
    ).data ?? [];

  const canAdmin = board?.access.canAdmin ?? false;
  const role = board?.access.role as Role | undefined;

  const invites =
    api.project.listInvites.useQuery(
      { projectId: project?.id ?? "" },
      { enabled: canAdmin && !!project?.id },
    ).data ?? [];
  const pending = invites.filter((i) => !i.acceptedAt).length;

  const online = new Set(
    api.realtime.presence.useQuery(
      { boardId: project?.boardId ?? "" },
      { enabled: !!project?.boardId },
    ).data ?? [],
  );
  // own presence event can race this tab's SSE listener; being on the board
  // route is authoritative for self (settings pages don't count)
  if (me && pathname === `/app/p/${slug}`) online.add(me.id);

  if (!project || members.length === 0) return null;

  const sorted = [...members].sort((a, b) => {
    const aOn = online.has(a.userId) ? 0 : 1;
    const bOn = online.has(b.userId) ? 0 : 1;
    if (aOn !== bOn) return aOn - bOn;
    const r = ROLE_RANK[a.role as Role] - ROLE_RANK[b.role as Role];
    return r !== 0 ? r : a.name.localeCompare(b.name);
  });
  const onlineCount = sorted.filter((m) => online.has(m.userId)).length;
  const shown = sorted.slice(0, 3);
  const extra = sorted.length - shown.length;
  const memberLabel = `${members.length} member${members.length === 1 ? "" : "s"}`;

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Team & presence"
        // presence is a desktop nicety; access lives in settings on phones
        className="gap-1.5 px-1.5 max-sm:hidden"
        render={<Button size="sm" variant="ghost" />}
      >
        <span className="flex -space-x-1.5">
          {shown.map((m) => (
            <span
              className={cn(
                "rounded-full ring-2",
                online.has(m.userId) ? "ring-success" : "ring-background",
              )}
              key={m.userId}
            >
              <UserAvatar image={m.image} name={m.name} size={20} />
            </span>
          ))}
          {extra > 0 ? (
            <span className="bg-muted text-muted-foreground ring-background flex size-5 items-center justify-center rounded-full text-[10px] font-medium ring-2">
              +{extra}
            </span>
          ) : null}
        </span>
        {pending > 0 ? (
          <span
            aria-hidden="true"
            className="bg-warning size-1.5 rounded-full"
          />
        ) : null}
        <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
      </PopoverTrigger>

      <PopoverPopup
        align="end"
        className="w-72 *:data-[slot=popover-viewport]:p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <span className="text-muted-foreground text-xs">
            {onlineCount > 0
              ? `${onlineCount} online · ${memberLabel}`
              : memberLabel}
          </span>
          {role ? (
            <Badge
              className={cn(
                "capitalize",
                role === "owner" && "border-ai/32 text-ai-foreground",
              )}
              size="sm"
              variant={ROLE_BADGE[role]}
            >
              {role}
            </Badge>
          ) : null}
        </div>

        <ScrollArea className="max-h-64">
          <ul className="flex flex-col p-1">
            {sorted.map((m) => {
              const isOnline = online.has(m.userId);
              return (
                <li
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
                  key={m.userId}
                >
                  <span className="relative shrink-0">
                    <UserAvatar
                      className={cn(!isOnline && "opacity-64")}
                      image={m.image}
                      name={m.name}
                      size={24}
                    />
                    {isOnline ? (
                      <span
                        aria-label="Online"
                        className="bg-success ring-popover absolute -end-0.5 -bottom-0.5 size-2 rounded-full ring-2"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {m.name}
                    {m.userId === me?.id ? (
                      <span className="text-muted-foreground"> (you)</span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs capitalize">
                    {m.role}
                  </span>
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        {canAdmin ? (
          <div className="border-t p-1">
            <Button
              className="w-full justify-start"
              render={<Link href={`/app/p/${slug}/settings/access`} />}
              size="sm"
              variant="ghost"
            >
              <UserPlusIcon aria-hidden="true" />
              {pending > 0
                ? `${pending} pending invite${pending === 1 ? "" : "s"}`
                : "Invite people"}
            </Button>
          </div>
        ) : null}
      </PopoverPopup>
    </Popover>
  );
}
