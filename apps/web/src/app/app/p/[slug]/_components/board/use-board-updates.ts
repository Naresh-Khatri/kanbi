"use client";

import { useCallback, useMemo } from "react";

import { api, type RouterOutputs } from "@/trpc/react";

export type TaskUpdate = RouterOutputs["board"]["updates"][number];

/** Unseen activity per task since this user's last look. */
export function useBoardUpdates(boardId: string) {
  const { data } = api.board.updates.useQuery({ boardId });
  return useMemo(
    () => new Map((data ?? []).map((u) => [u.taskId, u] as const)),
    [data],
  );
}

/** No taskId = whole board. Clears the cache first so badges drop instantly. */
export function useMarkSeen(boardId: string) {
  const utils = api.useUtils();
  const { mutate } = api.board.markSeen.useMutation({
    onSettled: () => utils.board.updates.invalidate({ boardId }),
  });
  return useCallback(
    (taskId?: string) => {
      utils.board.updates.setData({ boardId }, (old) =>
        taskId ? old?.filter((u) => u.taskId !== taskId) : [],
      );
      mutate({ boardId, taskId });
    },
    [boardId, mutate, utils],
  );
}

export function updateLabel(u: TaskUpdate): string {
  switch (u.reason) {
    case "done":
      return u.agent ? `Done by ${u.agent}` : "Moved to done";
    case "blocked":
      return u.agent ? `Blocked · ${u.agent}` : "Blocked";
    case "comment":
      return u.count > 1 ? "New comments" : "New comment";
    default:
      return u.agent ? `Updated by ${u.agent}` : "Updated";
  }
}
