"use client";

import { SunIcon, TimerIcon, XIcon } from "lucide-react";
import Link from "next/link";

import {
  type Priority,
  PriorityIcon,
} from "@/app/app/p/[slug]/_components/priority";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { toastManager } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

type Item = RouterOutputs["today"]["list"][number];

export function TodayQueue() {
  const [data] = api.today.list.useSuspenseQuery();
  const utils = api.useUtils();

  const onFail = (title: string) => (e: { message: string }) =>
    toastManager.add({ type: "error", title, description: e.message });

  const remove = api.today.remove.useMutation({
    onMutate: async (vars) => {
      await utils.today.list.cancel();
      const previous = utils.today.list.getData();
      utils.today.list.setData(undefined, (old) =>
        old?.filter((t) => t.taskId !== vars.taskId),
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) utils.today.list.setData(undefined, ctx.previous);
      onFail("Couldn't remove from Today")(e);
    },
    onSettled: () => utils.today.list.invalidate(),
  });

  const clearDone = api.today.clearDone.useMutation({
    onMutate: async () => {
      await utils.today.list.cancel();
      const previous = utils.today.list.getData();
      utils.today.list.setData(undefined, (old) =>
        old?.filter((item) => !isDone(item)),
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) utils.today.list.setData(undefined, ctx.previous);
      onFail("Couldn't clear done tasks")(e);
    },
    onSettled: () => utils.today.list.invalidate(),
  });

  const doneCount = data.filter(isDone).length;
  const totalEstimate = data
    .filter((item) => !isDone(item))
    .reduce((sum, t) => sum + (t.estimatePomodoros ?? 0), 0);

  if (data.length === 0) return null;

  return (
    <Card render={<section />}>
      <CardHeader className="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
        <SunIcon
          aria-hidden="true"
          className="text-warning-foreground size-4"
        />
        <CardTitle className="font-sans text-sm font-medium">Today</CardTitle>
        <span className="text-muted-foreground text-xs tabular-nums">
          {doneCount > 0 ? `${doneCount}/${data.length} done` : null}
          {doneCount > 0 && totalEstimate > 0 ? " · " : null}
          {totalEstimate > 0
            ? `~${totalEstimate} pomodoro${totalEstimate === 1 ? "" : "s"}`
            : null}
        </span>
        {doneCount > 0 ? (
          <CardAction className="ms-auto self-center">
            <Button
              onClick={() => clearDone.mutate()}
              size="xs"
              type="button"
              variant="ghost"
            >
              Clear done
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardPanel className="px-2 pt-0 pb-2">
        <ul className="flex flex-col">
          {data.map((item) => (
            <TodayRow
              item={item}
              key={item.taskId}
              onRemove={() => remove.mutate({ taskId: item.taskId })}
            />
          ))}
        </ul>
      </CardPanel>
    </Card>
  );
}

function TodayRow({ item, onRemove }: { item: Item; onRemove: () => void }) {
  const done = isDone(item);
  return (
    <li className="group hover:bg-accent flex items-center gap-1 rounded-lg ps-2 pe-1 transition-colors">
      <Link
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5"
        href={`/app/p/${item.projectSlug}?task=${item.taskId}`}
      >
        <PriorityIcon
          className={cn("size-3.5 shrink-0", done && "opacity-50")}
          priority={item.priority as Priority}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            done && "text-muted-foreground line-through",
          )}
        >
          {item.title}
        </span>
        {item.estimatePomodoros != null ? (
          <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs tabular-nums">
            <TimerIcon aria-hidden="true" className="size-3" />
            {item.estimatePomodoros}
          </span>
        ) : null}
        <span className="text-muted-foreground max-w-28 shrink-0 truncate text-xs">
          {item.projectName}
        </span>
      </Link>
      <Button
        aria-label="Remove from today"
        className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        onClick={onRemove}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <XIcon aria-hidden="true" />
      </Button>
    </li>
  );
}

function isDone(item: Item) {
  return (
    item.columnCategory === "completed" || item.columnCategory === "canceled"
  );
}
