"use client";

import { ChevronDown, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { Badge, Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type Role = "owner" | "editor" | "viewer";

const ROLE_RANK: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };

const ROLE_TONE = {
  owner: "ai",
  editor: "info",
  viewer: "neutral",
} as const satisfies Record<Role, "ai" | "info" | "neutral">;

/**
 * Single header control that folds together members, presence, the caller's
 * role, and pending invites — the avatar stack is the trigger, the popover
 * lists everyone with live online dots plus links into settings.
 */
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
  // The connection that marks this tab present can emit before its own SSE
  // listener is ready. Being on the board route is itself authoritative for
  // the current user; settings pages do not count as viewing the board.
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Team & presence"
          className="gap-2 pr-2 pl-1.5"
          size="sm"
          type="button"
          variant="toolbar"
        >
          <span className="flex -space-x-1.5">
            {shown.map((m) => (
              <span
                className={cn(
                  "rounded-full ring-2",
                  online.has(m.userId) ? "ring-success/70" : "ring-canvas",
                )}
                key={m.userId}
              >
                <UserAvatar image={m.image} name={m.name} size={22} />
              </span>
            ))}
            {extra > 0 ? (
              <span className="text-2xs ring-canvas flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70 ring-2">
                +{extra}
              </span>
            ) : null}
          </span>
          {pending > 0 ? <Dot className="bg-warning h-1.5 w-1.5" /> : null}
          <ChevronDown className="h-3.5 w-3.5 text-white/40" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs text-white/70">
            {onlineCount > 0
              ? `${onlineCount} online · ${members.length} member${members.length === 1 ? "" : "s"}`
              : `${members.length} member${members.length === 1 ? "" : "s"}`}
          </span>
          {role ? (
            <Badge className="capitalize" tone={ROLE_TONE[role]}>
              {role}
            </Badge>
          ) : null}
        </div>

        <DropdownMenuSeparator />

        <div className="max-h-64 overflow-y-auto py-0.5">
          {sorted.map((m) => {
            const isOnline = online.has(m.userId);
            return (
              <div
                className="flex items-center gap-2 px-2 py-1.5"
                key={m.userId}
              >
                <span className="relative shrink-0">
                  <UserAvatar
                    className={cn(!isOnline && "opacity-60")}
                    image={m.image}
                    name={m.name}
                    size={24}
                  />
                  {isOnline ? (
                    <Dot
                      className="bg-success ring-canvas absolute -right-0.5 -bottom-0.5 ring-2"
                      size="md"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-white">
                  {m.name}
                  {m.userId === me?.id ? (
                    <span className="text-white/40"> (you)</span>
                  ) : null}
                </span>
                <span className="text-2xs shrink-0 text-white/40 capitalize">
                  {m.role}
                </span>
              </div>
            );
          })}
        </div>

        {canAdmin && pending > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                className="text-warning"
                href={`/app/p/${slug}/settings#members`}
              >
                <UserPlus className="h-4 w-4" />
                {pending} pending invite{pending === 1 ? "" : "s"}
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
