"use client";

import { Eye } from "lucide-react";
import { useMemo } from "react";

import { PriorityBadge } from "@/app/app/p/[slug]/_components/priority";
import { Badge } from "@/components/ui/badge";
import { api, type RouterOutputs } from "@/trpc/react";
import { ShareUnavailable } from "./share-unavailable";

type PublicBoard = Extract<
  RouterOutputs["share"]["getPublic"],
  { status: "ok" }
>;
type PublicTask = PublicBoard["tasks"][number];

export function PublicBoardView({ token }: { token: string }) {
  // staleTime Infinity: the link is validated on load; don't refetch and risk
  // flipping to "exhausted" once recordView bumps the counter.
  const [data] = api.share.getPublic.useSuspenseQuery(
    { token },
    { staleTime: Infinity },
  );

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, PublicTask[]>();
    if (data.status !== "ok") return map;
    for (const c of data.columns) map.set(c.id, []);
    for (const t of data.tasks) {
      if (t.archivedAt) continue;
      map.get(t.columnId)?.push(t);
    }
    return map;
  }, [data]);

  if (data.status !== "ok") {
    return <ShareUnavailable status={data.status} />;
  }
  const { board, columns } = data;

  return (
    <main className="flex min-h-screen flex-col">
      <header className="bg-canvas/70 sticky top-0 z-40 flex items-center justify-between border-b border-white/10 px-6 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold">{board.projectName}</h1>
        <Badge>
          <Eye className="h-3 w-3" /> View only
        </Badge>
      </header>
      <div className="flex-1 overflow-x-auto">
        <div className="flex min-w-max gap-4 p-6">
          {columns.map((col) => (
            <div
              className="flex w-72 shrink-0 flex-col gap-3 rounded-lg bg-white/5 p-3"
              key={col.id}
            >
              <div className="flex items-center gap-2 px-1">
                <span className="text-sm font-medium">{col.name}</span>
                <span className="text-xs text-white/40">
                  {tasksByColumn.get(col.id)?.length ?? 0}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {(tasksByColumn.get(col.id) ?? []).map((t) => (
                  <div
                    className="bg-raised rounded-lg border border-white/10 p-3"
                    key={t.id}
                  >
                    <p className="text-sm leading-snug">{t.title}</p>
                    {t.priority !== "none" ? (
                      <div className="mt-2">
                        <PriorityBadge priority={t.priority} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
