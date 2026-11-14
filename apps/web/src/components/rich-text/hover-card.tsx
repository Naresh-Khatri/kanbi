"use client";

import {
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  HashIcon,
  UnlinkIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import type { MentionItem, TicketMentionItem } from "./mention";

/** Fired when a ticket chip is clicked in a read-only render; the board view listens. */
export const OPEN_TASK_EVENT = "kanbi:open-task";

/**
 * The one inline hover card (links, task refs, people): `trigger` is the
 * element the inline chip renders as, `content` mounts only while open.
 */
export function HoverCard({
  trigger,
  children,
  content,
  className,
}: {
  trigger: React.ReactElement;
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}) {
  return (
    <PreviewCard>
      <PreviewCardTrigger closeDelay={100} delay={300} render={trigger}>
        {children}
      </PreviewCardTrigger>
      <PreviewCardPopup
        align="start"
        className={cn("w-80 flex-col gap-2 p-3 text-pretty", className)}
      >
        {content}
      </PreviewCardPopup>
    </PreviewCard>
  );
}

function CardHeader({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs [&>svg]:size-3.5 [&>svg]:shrink-0">
      {icon}
      <span className="truncate">{children}</span>
    </div>
  );
}

function CardBody({
  title,
  text,
}: {
  title: React.ReactNode;
  text?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="line-clamp-2 text-sm leading-snug font-medium">
        {title}
      </span>
      {text ? (
        <span className="text-muted-foreground line-clamp-2 text-xs">
          {text}
        </span>
      ) : null}
    </div>
  );
}

function CardActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1">{children}</div>;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      onClick={() =>
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      size="xs"
      type="button"
      variant="ghost"
    >
      {copied ? (
        <CheckIcon aria-hidden="true" />
      ) : (
        <CopyIcon aria-hidden="true" />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Opens a task in place (board listens) or via its route outside the board. */
export function useOpenTask() {
  const router = useRouter();
  return (item: Pick<TicketMentionItem, "id" | "href">) => {
    if (item.href) router.push(item.href);
    else
      window.dispatchEvent(
        new CustomEvent(OPEN_TASK_EVENT, { detail: { taskId: item.id } }),
      );
  };
}

export function TaskCard({ item }: { item: TicketMentionItem }) {
  const openTask = useOpenTask();
  const priority = item.priority ? PRIORITY_LABEL[item.priority] : undefined;
  const meta = [priority, item.assignee ?? "Unassigned"].filter(Boolean);
  return (
    <>
      <CardHeader icon={<HashIcon aria-hidden="true" />}>
        <span className="font-mono">{item.label}</span>
        {item.status ? ` · ${item.status}` : null}
      </CardHeader>
      <CardBody text={meta.join(" · ")} title={item.title} />
      <CardActions>
        <Button
          onClick={() => openTask(item)}
          size="xs"
          type="button"
          variant="outline"
        >
          <ArrowUpRightIcon aria-hidden="true" />
          Open task
        </Button>
        <CopyButton label="Copy ID" value={item.label} />
      </CardActions>
    </>
  );
}

export function PersonCard({ item }: { item: MentionItem }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <UserAvatar image={item.image} name={item.label} size={36} />
      <CardBody text={item.sublabel} title={item.label} />
    </div>
  );
}

// own-app urls would only fetch our login page
const isExternal = (href: string) => {
  try {
    const url = new URL(href);
    return /^https?:$/.test(url.protocol) && url.origin !== location.origin;
  } catch {
    return false;
  }
};

const hostOf = (href: string) => {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
};

export function LinkCard({
  href,
  onRemove,
}: {
  href: string;
  onRemove?: () => void;
}) {
  const external = isExternal(href);
  const preview = api.link.preview.useQuery(
    { url: href },
    { enabled: external, staleTime: Infinity, retry: false },
  );
  const data = preview.data;

  return (
    <>
      <CardHeader
        icon={
          data?.icon ? (
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 rounded-xs bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url("${data.icon}")` }}
            />
          ) : (
            <GlobeIcon aria-hidden="true" />
          )
        }
      >
        {data?.siteName ?? hostOf(href)}
      </CardHeader>
      {preview.isLoading ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      ) : data?.title ? (
        <CardBody text={data.description} title={data.title} />
      ) : null}
      <span className="text-muted-foreground truncate text-xs">{href}</span>
      <CardActions>
        <Button
          render={
            <a href={href} rel="noopener noreferrer nofollow" target="_blank" />
          }
          size="xs"
          variant="outline"
        >
          <ArrowUpRightIcon aria-hidden="true" />
          Open
        </Button>
        <CopyButton label="Copy" value={href} />
        {onRemove ? (
          <Button
            className="ms-auto"
            onClick={onRemove}
            size="xs"
            type="button"
            variant="ghost"
          >
            <UnlinkIcon aria-hidden="true" />
            Remove
          </Button>
        ) : null}
      </CardActions>
    </>
  );
}
