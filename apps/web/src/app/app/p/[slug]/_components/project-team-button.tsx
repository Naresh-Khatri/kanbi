"use client";

import { ChevronDown, Settings, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

const ROLE_BADGE: Record<Role, string> = {
  owner: "bg-violet-400/10 text-violet-300",
  editor: "bg-sky-400/10 text-sky-300",
  viewer: "bg-white/5 text-white/70",
};

/**
 * Single header control that folds together members, presence, the caller's
 * role, and pending invites — the avatar stack is the trigger, the popover
 * lists everyone with live online dots plus links into settings.
 */
export function ProjectTeamButton() {
  const { slug } = useParams<{ slug: string }>();
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
        <button
          aria-label="Team & presence"
          className="inline-flex h-8 items-center gap-2 rounded-md border border-white/15 bg-white/5 pr-2 pl-1.5 text-sm text-white/80 transition outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/30"
          type="button"
        >
          <span className="flex -space-x-1.5">
            {shown.map((m) => (
              <span
                className={cn(
                  "rounded-full ring-2",
                  online.has(m.userId)
                    ? "ring-emerald-400/80"
                    : "ring-[#0b0b0f]",
                )}
                key={m.userId}
              >
                <UserAvatar image={m.image} name={m.name} size={22} />
              </span>
            ))}
            {extra > 0 ? (
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white/10 text-[10px] text-white/80 ring-2 ring-[#0b0b0f]">
                +{extra}
              </span>
            ) : null}
          </span>
          {pending > 0 ? (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          ) : null}
          <ChevronDown className="h-3.5 w-3.5 text-white/40" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs text-white/50">
            {onlineCount > 0
              ? `${onlineCount} online · ${members.length} member${members.length === 1 ? "" : "s"}`
              : `${members.length} member${members.length === 1 ? "" : "s"}`}
          </span>
          {role ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] capitalize",
                ROLE_BADGE[role],
              )}
            >
              {role}
            </span>
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
                    <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0b0b0f]" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                  {m.name}
                  {m.userId === me?.id ? (
                    <span className="text-white/40"> (you)</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[11px] text-white/40 capitalize">
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
                className="text-amber-300"
                href={`/app/p/${slug}/settings#members`}
              >
                <UserPlus className="h-4 w-4" />
                {pending} pending invite{pending === 1 ? "" : "s"}
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/app/p/${slug}/settings`}>
            <Settings className="h-4 w-4" />
            Project settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
