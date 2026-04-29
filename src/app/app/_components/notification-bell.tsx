"use client";

import { Bell, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { api, type RouterOutputs } from "@/trpc/react";

type NotificationRow = RouterOutputs["notification"]["list"][number];

type ActionKind = "accept-invite" | "decline-invite";

type NotificationAction = {
  label: string;
  kind: ActionKind;
  variant: "primary" | "ghost";
  token?: string;
};

const POLL_MS = 30_000;

function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return date.toLocaleDateString();
}

function describe(n: NotificationRow): {
  text: string;
  href: string | null;
  actions?: NotificationAction[];
} {
  const actor = n.actorName ?? "Someone";
  const data = (n.data ?? {}) as Record<string, unknown>;
  const taskTitle =
    n.taskTitle ?? (typeof data.title === "string" ? data.title : "a task");
  const projectName =
    n.projectName ??
    (typeof data.projectName === "string" ? data.projectName : "a project");
  const columnName =
    typeof data.columnName === "string" ? data.columnName : "Done";
  const taskHref =
    n.projectSlug && n.taskId
      ? `/app/p/${n.projectSlug}?task=${n.taskId}`
      : n.projectSlug
        ? `/app/p/${n.projectSlug}`
        : null;

  switch (n.type) {
    case "task.assigned":
      return {
        text: `${actor} assigned you to "${taskTitle}"`,
        href: taskHref,
      };
    case "task.unassigned":
      return {
        text: `${actor} unassigned you from "${taskTitle}"`,
        href: taskHref,
      };
    case "task.comment":
      return {
        text: `${actor} commented on "${taskTitle}"`,
        href: taskHref,
      };
    case "task.mention":
      return {
        text: `${actor} mentioned you on "${taskTitle}"`,
        href: taskHref,
      };
    case "task.moved_to_done":
      return {
        text: `${actor} moved "${taskTitle}" to ${columnName}`,
        href: taskHref,
      };
    case "task.due_soon":
      return {
        text: `"${taskTitle}" is due soon`,
        href: taskHref,
      };
    case "task.checklist_completed":
      return {
        text: `${actor} completed the checklist on "${taskTitle}"`,
        href: taskHref,
      };
    case "project.invited": {
      const token = typeof data.token === "string" ? data.token : null;
      return {
        text: `${actor} invited you to ${projectName}`,
        href: token ? `/invite/${token}` : null,
        actions: token
          ? [
              {
                label: "Accept",
                kind: "accept-invite",
                variant: "primary",
                token,
              },
              {
                label: "Decline",
                kind: "decline-invite",
                variant: "ghost",
                token,
              },
            ]
          : undefined,
      };
    }
    case "project.member_joined":
      return {
        text: `${actor} joined ${projectName}`,
        href: n.projectSlug ? `/app/p/${n.projectSlug}` : null,
      };
    default:
      return { text: `${actor} sent you an update`, href: taskHref };
  }
}

export function NotificationBell() {
  const utils = api.useUtils();
  const unread = api.notification.unreadCount.useQuery(undefined, {
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });
  const list = api.notification.list.useQuery(
    { limit: 30 },
    { refetchInterval: POLL_MS, refetchOnWindowFocus: true },
  );

  api.notification.onChange.useSubscription(undefined, {
    onData: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });

  const markRead = api.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });
  const markAllRead = api.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });
  const router = useRouter();
  const acceptInvite = api.project.acceptInvite.useMutation({
    onSuccess: (res) => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
      utils.project.list.invalidate();
      if (res?.projectSlug) router.push(`/app/p/${res.projectSlug}`);
    },
  });
  const declineInvite = api.project.declineInvite.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });

  const runAction = (action: NotificationAction, notificationId: string) => {
    if (action.kind === "accept-invite" && action.token) {
      acceptInvite.mutate({ token: action.token });
    } else if (action.kind === "decline-invite" && action.token) {
      declineInvite.mutate({ token: action.token });
    }
    markRead.mutate({ ids: [notificationId] });
  };

  const items = list.data ?? [];
  const unreadCount = unread.data ?? 0;

  const hasUnread = useMemo(() => items.some((n) => !n.readAt), [items]);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          utils.notification.list.invalidate();
          utils.notification.unreadCount.invalidate();
        }
      }}
    >
      <DropdownMenuTrigger
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 flex min-w-[1rem] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {hasUnread ? (
            <button
              className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white"
              onClick={() => markAllRead.mutate()}
              type="button"
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-white/50">
              You're all caught up.
            </div>
          ) : (
            items.map((n) => {
              const { text, href, actions } = describe(n);
              const unread = !n.readAt;
              const createdAt =
                n.createdAt instanceof Date
                  ? n.createdAt
                  : new Date(n.createdAt);
              const rowClass = `border-white/5 border-b px-3 py-2.5 transition hover:bg-white/[0.04] ${
                unread ? "bg-white/[0.02]" : ""
              }`;
              const handleClick = () => {
                if (unread) markRead.mutate({ ids: [n.id] });
              };
              const body = (
                <>
                  <div className="flex items-start gap-2">
                    <UserAvatar
                      image={n.actorImage ?? null}
                      name={n.actorName ?? "?"}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate-2 text-sm leading-snug text-white/90">
                        {text}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        {timeAgo(createdAt)}
                      </p>
                    </div>
                    {unread ? (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                    ) : null}
                  </div>
                  {actions && actions.length > 0 ? (
                    <div className="mt-2 ml-9 flex items-center gap-2">
                      {actions.map((a) => (
                        <button
                          className={
                            a.variant === "primary"
                              ? "rounded-md bg-sky-500 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-sky-400"
                              : "rounded-md px-2 py-1 text-[11px] text-white/60 transition hover:bg-white/10 hover:text-white"
                          }
                          disabled={
                            acceptInvite.isPending || declineInvite.isPending
                          }
                          key={a.kind}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            runAction(a, n.id);
                          }}
                          type="button"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              );
              return href ? (
                <Link
                  className={`block ${rowClass}`}
                  href={href}
                  key={n.id}
                  onClick={handleClick}
                >
                  {body}
                </Link>
              ) : (
                <button
                  className={`block w-full text-left ${rowClass}`}
                  key={n.id}
                  onClick={handleClick}
                  type="button"
                >
                  {body}
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
