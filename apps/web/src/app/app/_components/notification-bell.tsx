"use client";

import { formatDateTime, formatRelative } from "@kanbi/shared";
import { BellIcon, CheckCheckIcon, InboxIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Popover,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

type NotificationRow = RouterOutputs["notification"]["list"][number];

type ActionKind = "accept-invite" | "decline-invite";

type NotificationAction = {
  label: string;
  kind: ActionKind;
  variant: "default" | "ghost";
  token?: string;
};

const POLL_MS = 30_000;

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
                variant: "default",
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
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const unread = api.notification.unreadCount.useQuery(undefined, {
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });
  const list = api.notification.list.useQuery(
    { limit: 30 },
    { refetchInterval: POLL_MS, refetchOnWindowFocus: true },
  );

  const refresh = () => {
    void utils.notification.list.invalidate();
    void utils.notification.unreadCount.invalidate();
  };

  api.notification.onChange.useSubscription(undefined, { onData: refresh });

  const markRead = api.notification.markRead.useMutation({
    onSuccess: refresh,
  });
  const markAllRead = api.notification.markAllRead.useMutation({
    onSuccess: refresh,
  });
  const acceptInvite = api.project.acceptInvite.useMutation({
    onSuccess: (res) => {
      refresh();
      void utils.project.list.invalidate();
      if (res?.projectSlug) router.push(`/app/p/${res.projectSlug}`);
    },
  });
  const declineInvite = api.project.declineInvite.useMutation({
    onSuccess: refresh,
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
  const hasUnread = items.some((n) => !n.readAt);
  const countLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  const close = () => setOpen(false);

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (next) refresh();
      }}
      open={open}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              aria-label={
                unreadCount > 0 ? `Inbox, ${countLabel} unread` : "Inbox"
              }
              render={
                <Button className="relative" size="icon-sm" variant="ghost" />
              }
            />
          }
        >
          <BellIcon aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="bg-info ring-background absolute top-1.5 right-1.5 size-2 rounded-full ring-2" />
          ) : null}
        </TooltipTrigger>
        <TooltipPopup>Inbox</TooltipPopup>
      </Tooltip>
      <PopoverPopup
        align="end"
        // never flip beside the bell; shrink the list instead
        collisionAvoidance={{ fallbackAxisSide: "none" }}
        className="w-96 *:data-[slot=popover-viewport]:p-0"
      >
        <div className="flex h-11 items-center justify-between gap-2 border-b ps-4 pe-2">
          <PopoverTitle className="text-sm">Inbox</PopoverTitle>
          {hasUnread ? (
            <Button
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
              size="xs"
              variant="ghost"
            >
              <CheckCheckIcon aria-hidden="true" />
              Mark all read
            </Button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <Empty className="py-10 md:py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-base">
                You&apos;re all caught up
              </EmptyTitle>
              <EmptyDescription>
                Assignments, mentions and invites land here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          // not --available-height: base ui measures with it = max-content -> uncapped list, tall positioner
          <ScrollArea className="max-h-[min(28rem,calc(100svh-7rem))]">
            <ul className="flex flex-col divide-y">
              {items.map((n) => {
                const { text, href, actions } = describe(n);
                const isUnread = !n.readAt;
                const createdAt =
                  n.createdAt instanceof Date
                    ? n.createdAt
                    : new Date(n.createdAt);
                const onOpen = () => {
                  if (isUnread) markRead.mutate({ ids: [n.id] });
                  if (href) close();
                };
                const rowClass = cn(
                  "hover:bg-accent focus-visible:bg-accent flex w-full items-start gap-3 px-4 py-3 text-start transition-colors outline-none",
                  isUnread && "bg-info/8",
                );
                const content = (
                  <>
                    <UserAvatar
                      image={n.actorImage ?? null}
                      name={n.actorName ?? "?"}
                      size={28}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={cn(
                          "line-clamp-2 text-sm leading-snug",
                          isUnread
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {text}
                      </span>
                      <span
                        className="text-muted-foreground text-xs"
                        title={formatDateTime(createdAt)}
                      >
                        {formatRelative(createdAt)}
                      </span>
                    </span>
                    {isUnread ? (
                      <span
                        aria-label="Unread"
                        className="bg-info mt-1.5 size-2 shrink-0 rounded-full"
                      />
                    ) : null}
                  </>
                );
                return (
                  <li key={n.id}>
                    {href ? (
                      <Link className={rowClass} href={href} onClick={onOpen}>
                        {content}
                      </Link>
                    ) : (
                      <button
                        className={rowClass}
                        onClick={onOpen}
                        type="button"
                      >
                        {content}
                      </button>
                    )}
                    {actions && actions.length > 0 ? (
                      <div className="flex items-center gap-2 ps-15 pe-4 pb-3">
                        {actions.map((a) => (
                          <Button
                            disabled={
                              acceptInvite.isPending || declineInvite.isPending
                            }
                            key={a.kind}
                            onClick={() => runAction(a, n.id)}
                            size="xs"
                            variant={a.variant}
                          >
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverPopup>
    </Popover>
  );
}
