"use client";

import {
  formatDate,
  formatDateRange,
  formatRelative,
  formatWeekday,
} from "@kanbi/shared";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  MessageSquareIcon,
  PlusIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { UserAvatar } from "@/components/user-avatar";
import type { DigestCategory, DigestHighlight } from "@/server/db/schema";
import { api } from "@/trpc/react";

type Member = { userId: string; name: string | null; image: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;

const STAT_DEFS = [
  { key: "created", label: "created", Icon: PlusIcon, accent: false },
  { key: "moved", label: "moved", Icon: ArrowRightIcon, accent: false },
  {
    key: "completed",
    label: "completed",
    Icon: CheckCircle2Icon,
    accent: true,
  },
  {
    key: "comments",
    label: "comments",
    Icon: MessageSquareIcon,
    accent: false,
  },
] as const;

const GROUPS: { category: DigestCategory; label: string }[] = [
  { category: "shipped", label: "Shipped" },
  { category: "progress", label: "In progress" },
  { category: "created", label: "Created" },
  { category: "discussion", label: "Discussion" },
  { category: "other", label: "Also notable" },
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Sparkline({ data, start }: { data: number[]; start: Date | string }) {
  const max = Math.max(1, ...data);
  const startMs = new Date(start).getTime();
  return (
    <div className="flex h-7 items-end gap-1">
      {data.map((v, i) => {
        const day = new Date(startMs + i * DAY_MS);
        const label = `${formatWeekday(day)}, ${formatDate(day, {
          relativeDays: false,
        })}`;
        return (
          <div
            className="bg-info/24 dark:bg-info/32 flex-1 rounded-sm"
            key={i}
            style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
            title={`${label}: ${v} update${v === 1 ? "" : "s"}`}
          />
        );
      })}
    </div>
  );
}

function FormattedSummary({ text, names }: { text: string; names: string[] }) {
  const nodes = useMemo(() => {
    const sorted = names
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);
    const namePart = sorted.length ? `|${sorted.join("|")}` : "";
    const re = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?${namePart})`, "gi");
    const nameSet = new Set(names.map((n) => n.toLowerCase()));
    return text.split(re).map((part, i) => {
      if (!part) return null;
      if (/^\d/.test(part))
        return (
          <strong className="text-foreground font-semibold" key={i}>
            {part}
          </strong>
        );
      if (nameSet.has(part.toLowerCase()))
        return (
          <span className="text-foreground font-medium" key={i}>
            {part}
          </span>
        );
      return <span key={i}>{part}</span>;
    });
  }, [text, names]);

  return (
    <p className="text-muted-foreground text-sm leading-relaxed">{nodes}</p>
  );
}

function HighlightRow({
  highlight: h,
  image,
  onOpen,
}: {
  highlight: DigestHighlight;
  image: string | null;
  onOpen?: () => void;
}) {
  const inner = (
    <>
      {h.actor ? (
        <UserAvatar className="mt-0.5" image={image} name={h.actor} size={20} />
      ) : (
        <span
          aria-hidden="true"
          className="bg-muted-foreground/40 mx-[7px] mt-2 size-1.5 shrink-0 rounded-full"
        />
      )}
      <p className="text-muted-foreground text-sm leading-relaxed">
        {h.actor ? (
          <span className="text-foreground font-medium">{h.actor} </span>
        ) : null}
        {h.action}
        {h.task ? (
          <span className="text-foreground font-medium"> “{h.task}”</span>
        ) : null}
      </p>
    </>
  );

  if (onOpen) {
    return (
      <li>
        <button
          className="hover:bg-accent focus-visible:ring-ring -mx-2 flex w-[calc(100%+--spacing(4))] items-start gap-2.5 rounded-md px-2 py-1 text-start transition-colors outline-none focus-visible:ring-2"
          onClick={onOpen}
          type="button"
        >
          {inner}
        </button>
      </li>
    );
  }
  return <li className="flex items-start gap-2.5 py-1">{inner}</li>;
}

export function DigestPanel({
  boardId,
  open,
  onOpenChange,
  canWrite,
  members,
  onOpenTask,
}: {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  members: Member[];
  onOpenTask?: (taskId: string) => void;
}) {
  const utils = api.useUtils();
  const latest = api.digest.latest.useQuery({ boardId }, { enabled: open });
  const generate = api.digest.generate.useMutation({
    onSuccess: () => utils.digest.latest.invalidate({ boardId }),
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });

  const { nameToImage, memberNames } = useMemo(() => {
    const nameToImage = new Map<string, string | null>();
    const memberNames: string[] = [];
    for (const m of members) {
      if (m.name) {
        nameToImage.set(m.name.toLowerCase(), m.image);
        memberNames.push(m.name);
      }
    }
    return { nameToImage, memberNames };
  }, [members]);
  const imageById = useMemo(
    () => new Map(members.map((m) => [m.userId, m.image])),
    [members],
  );

  const digest = latest.data;
  const highlights = digest ? digest.content.highlights : [];
  const people = digest ? digest.content.people : [];
  const activity = digest ? digest.content.activity : [];

  const groups = GROUPS.map((g) => ({
    ...g,
    items: highlights.filter((h) => h.category === g.category),
  })).filter((g) => g.items.length > 0);
  const showLabels = groups.length > 1;

  return (
    <Drawer onOpenChange={onOpenChange} open={open} position="right">
      <DrawerPopup showCloseButton variant="inset">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <SparklesIcon
              aria-hidden="true"
              className="text-ai-foreground size-4"
            />
            Weekly digest
          </DrawerTitle>
          <DrawerDescription>
            {digest
              ? formatDateRange(digest.periodStart, digest.periodEnd)
              : "An AI summary of the last 7 days of board activity."}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerPanel>
          {latest.isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center py-10">
              <Spinner className="size-5" />
            </div>
          ) : digest ? (
            <div className="flex flex-col gap-5">
              <h3 className="font-heading text-lg leading-snug font-semibold">
                {digest.content.headline}
              </h3>

              <div className="flex flex-wrap items-center gap-1.5">
                {STAT_DEFS.map(({ key, label, Icon, accent }) => {
                  const value = digest.content.stats[key];
                  if (!value) return null;
                  return (
                    <Badge key={key} variant={accent ? "success" : "secondary"}>
                      <Icon aria-hidden="true" />
                      <span className="font-semibold tabular-nums">
                        {value}
                      </span>
                      {label}
                    </Badge>
                  );
                })}
                {people.length > 0 ? (
                  <Badge className="ps-0.5" variant="secondary">
                    <span className="flex -space-x-1">
                      {people.slice(0, 5).map((p) => (
                        <UserAvatar
                          className="ring-popover ring-2"
                          image={imageById.get(p.id) ?? null}
                          key={p.id}
                          name={p.name}
                          size={16}
                        />
                      ))}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {people.length}
                    </span>
                    {people.length === 1 ? "person" : "people"}
                  </Badge>
                ) : null}
              </div>

              {activity.some((v) => v > 0) ? (
                <Sparkline data={activity} start={digest.periodStart} />
              ) : null}

              <FormattedSummary
                names={memberNames}
                text={digest.content.summary}
              />

              {groups.length > 0 ? (
                <div className="flex flex-col gap-4 border-t pt-4">
                  {groups.map((g) => (
                    <section className="flex flex-col gap-1.5" key={g.category}>
                      {showLabels ? (
                        <h4
                          className={
                            g.category === "shipped"
                              ? "text-success-foreground text-xs font-medium"
                              : "text-muted-foreground text-xs font-medium"
                          }
                        >
                          {g.label}
                        </h4>
                      ) : null}
                      <ul className="flex flex-col gap-0.5">
                        {g.items.map((h, i) => (
                          <HighlightRow
                            highlight={h}
                            image={
                              h.actor
                                ? (nameToImage.get(h.actor.toLowerCase()) ??
                                  null)
                                : null
                            }
                            key={i}
                            onOpen={
                              h.taskId && onOpenTask
                                ? () => {
                                    onOpenTask(h.taskId!);
                                    onOpenChange(false);
                                  }
                                : undefined
                            }
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <Empty className="py-12 md:py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SparklesIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No digest yet</EmptyTitle>
                <EmptyDescription>
                  {canWrite
                    ? "Generate one to see what happened this week."
                    : "Ask an editor to generate one."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </DrawerPanel>

        {digest || canWrite ? (
          <DrawerFooter className="items-center sm:justify-between">
            <span className="text-muted-foreground text-xs">
              {digest ? `Generated ${formatRelative(digest.createdAt)}` : ""}
            </span>
            {canWrite ? (
              <Button
                loading={generate.isPending}
                onClick={() => generate.mutate({ boardId })}
                size="sm"
                variant={digest ? "outline" : "default"}
              >
                {digest ? (
                  <RefreshCwIcon aria-hidden="true" />
                ) : (
                  <SparklesIcon aria-hidden="true" />
                )}
                {digest ? "Regenerate" : "Generate this week"}
              </Button>
            ) : null}
          </DrawerFooter>
        ) : null}
      </DrawerPopup>
    </Drawer>
  );
}
