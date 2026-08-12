"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import {
  type Priority,
  PriorityIcon,
} from "@/app/app/p/[slug]/_components/priority";
import { isDoneLikeColumn } from "@/lib/column-heuristics";
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
        old?.filter((t) => !isDoneLikeColumn(t.columnName)),
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) utils.today.list.setData(undefined, ctx.previous);
      toast.error(e.message);
    },
    onSettled: () => utils.today.list.invalidate(),
  });

  const doneCount = data.filter((t) => isDoneLikeColumn(t.columnName)).length;

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Today</h2>
        {doneCount > 0 ? (
          <span className="text-xs text-white/40">
            {doneCount}/{data.length} done
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
      {data.length === 0 ? (
        <p className="py-1 text-sm text-white/40">
          Nothing queued for today — add tasks from any board.
        </p>
      ) : (
        <ul className="flex flex-col">
          {data.map((item) => (
            <TodayRow
              item={item}
              key={item.taskId}
              onRemove={() => remove.mutate({ taskId: item.taskId })}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TodayRow({
  item,
  onRemove,
}: {
  item: Item;
  onRemove: () => void;
}) {
  const done = isDoneLikeColumn(item.columnName);
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
        <span className="max-w-[7rem] shrink-0 truncate text-xs text-white/40">
          {item.projectName}
        </span>
      </Link>
      <button
        aria-label="Remove from today"
        className="shrink-0 rounded p-1 text-white/40 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
        onClick={onRemove}
        type="button"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
