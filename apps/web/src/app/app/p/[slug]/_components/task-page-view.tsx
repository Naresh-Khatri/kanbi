"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { Button } from "@/components/ui/button";
import { taskBoardHref, taskPageHref } from "@/lib/task-link";
import { api } from "@/trpc/react";
import type { MemberInfo } from "./board/board-types";
import { useBoardRealtime } from "./board/use-board-realtime";
import { useBoardUpdates, useMarkSeen } from "./board/use-board-updates";
import { useTicketItems } from "./board/use-ticket-items";
import { TaskDetail } from "./task-detail-sheet";
import { setTaskViewMode } from "./task-view-mode";

export function TaskPageView({
  boardId,
  projectId,
  projectKey,
  projectSlug,
  number,
}: {
  boardId: string;
  projectId: string;
  projectKey: string;
  projectSlug: string;
  number: number;
}) {
  const router = useRouter();
  const [data] = api.board.get.useSuspenseQuery({ boardId });
  const membersQuery = api.project.members.useQuery({ projectId });
  const membersById = useMemo(() => {
    const map = new Map<string, MemberInfo>();
    for (const m of membersQuery.data ?? []) {
      map.set(m.userId, { name: m.name, image: m.image });
    }
    return map;
  }, [membersQuery.data]);
  useBoardRealtime(boardId);

  const { columns, tasks, labels, taskLabels, access } = data;
  const task = tasks.find((t) => t.number === number) ?? null;
  const baseTickets = useTicketItems(tasks, columns, projectKey, membersById);
  // no board mounted here -> chips navigate instead of dispatching
  const tickets = useMemo(
    () =>
      baseTickets.map((t, i) => ({
        ...t,
        href: taskPageHref(projectSlug, tasks[i]!.number),
      })),
    [baseTickets, tasks, projectSlug],
  );

  const updates = useBoardUpdates(boardId);
  const markSeen = useMarkSeen(boardId);
  const hasUpdate = !!task && updates.has(task.id);
  useEffect(() => {
    if (task && hasUpdate) markSeen(task.id);
  }, [task, hasUpdate, markSeen]);

  const boardHref = `/app/p/${projectSlug}`;
  useHotkeys("esc", (e) => {
    // menus/pickers/lightbox close on esc first
    if (e.defaultPrevented) return;
    if (
      document.querySelector('[role="dialog"],[role="menu"],[role="listbox"]')
    )
      return;
    router.push(boardHref);
  });

  if (!task) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-muted-foreground text-sm">
          {projectKey}-{number} doesn&apos;t exist or was deleted.
        </p>
        <Button render={<Link href={boardHref} />} size="sm" variant="outline">
          Back to board
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl pb-12">
        <TaskDetail
          boardId={boardId}
          canWrite={access.canWrite}
          columns={columns}
          key={task.id}
          labels={labels}
          onClose={() => router.push(boardHref)}
          onToggleView={() => {
            setTaskViewMode("sheet");
            router.push(taskBoardHref(projectSlug, task.number));
          }}
          projectId={projectId}
          projectKey={projectKey}
          projectSlug={projectSlug}
          task={task}
          taskLabels={taskLabels.filter((tl) => tl.taskId === task.id)}
          tasks={tasks}
          tickets={tickets}
          variant="page"
        />
      </div>
    </main>
  );
}
