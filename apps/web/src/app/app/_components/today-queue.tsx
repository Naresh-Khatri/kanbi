"use client";

import { Timer, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import {
  type Priority,
  PriorityIcon,
} from "@/app/app/p/[slug]/_components/priority";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

type Item = RouterOutputs["today"]["list"][number];

export function TodayQueue() {
  const [data] = api.today.list.useSuspenseQuery();
  const utils = api.useUtils();

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
      toast.error(e.message);
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
      toast.error(e.message);
    },
    onSettled: () => utils.today.list.invalidate(),
  });

  const doneCount = data.filter(isDone).length;
  const totalEstimate = data
    .filter((item) => !isDone(item))
    .reduce((sum, t) => sum + (t.estimatePomodoros ?? 0), 0);

  if (data.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Today</h2>
        {doneCount > 0 ? (
          <span className="text-xs text-white/40">
            {doneCount}/{data.length} done
          </span>
        ) : null}
        {totalEstimate > 0 ? (
          <span className="text-xs text-white/40">
            ~{totalEstimate} pomodoro{totalEstimate === 1 ? "" : "s"}
          </span>
        ) : null}
        {doneCount > 0 ? (
          <button
            className="ml-auto text-xs text-white/50 transition hover:text-white/80"
            onClick={() => clearDone.mutate()}
            type="button"
          >
            Clear done
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col">
        {data.map((item) => (
          <TodayRow
            item={item}
            key={item.taskId}
            onRemove={() => remove.mutate({ taskId: item.taskId })}
          />
        ))}
      </ul>
    </section>
  );
}

function TodayRow({ item, onRemove }: { item: Item; onRemove: () => void }) {
  const done = isDone(item);
  return (
    <li className="group -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-white/5">
      <Link
        className="flex min-w-0 flex-1 items-center gap-2"
        href={`/app/p/${item.projectSlug}?task=${item.taskId}`}
      >
        <PriorityIcon
          className={cn("h-3.5 w-3.5 shrink-0", done && "opacity-50")}
          priority={item.priority as Priority}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            done && "text-white/40 line-through",
          )}
        >
          {item.title}
        </span>
        {item.estimatePomodoros != null ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-white/40">
            <Timer className="h-3 w-3" />
            {item.estimatePomodoros}
          </span>
        ) : null}
        <span className="max-w-[7rem] shrink-0 truncate text-xs text-white/40">
          {item.projectName}
        </span>
      </Link>
      <button
        aria-label="Remove from today"
        className="shrink-0 rounded p-1 text-white/40 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white"
        onClick={onRemove}
        type="button"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function isDone(item: Item) {
  return (
    item.columnCategory === "completed" || item.columnCategory === "canceled"
  );
}
