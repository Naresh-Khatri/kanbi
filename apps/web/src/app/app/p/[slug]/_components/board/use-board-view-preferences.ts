"use client";

import { useCallback } from "react";
import { toastManager } from "@/components/ui/toast";
import type { ColumnSortDir, ColumnSortMode } from "@/lib/task-sort";
import { api } from "@/trpc/react";

type ColumnSort = { mode: ColumnSortMode; dir: ColumnSortDir };

export type BoardViewPreferences = {
  sorts: Record<string, ColumnSort>;
  hiddenColumnIds: string[];
  collapsedColumnIds: string[];
  defaultColumnId: string | null;
  milestoneFilter: string | null;
};

export function useBoardViewPreferences(
  boardId: string,
  preferences: BoardViewPreferences,
) {
  const utils = api.useUtils();
  const save = api.board.setViewPreferences.useMutation({
    scope: { id: `board-view-preferences:${boardId}` },
    onMutate: async (vars) => {
      await utils.board.get.cancel({ boardId });
      const previous = utils.board.get.getData({ boardId });
      const { boardId: _boardId, ...next } = vars;
      utils.board.get.setData({ boardId }, (old) =>
        old
          ? {
              ...old,
              viewPreferences: {
                ...next,
                milestoneFilter: next.milestoneFilter ?? null,
              },
            }
          : old,
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        utils.board.get.setData({ boardId }, context.previous);
      }
      toastManager.add({
        type: "error",
        title: error.message || "Couldn't save view preferences",
      });
    },
  });

  const update = useCallback(
    (getNext: (current: BoardViewPreferences) => BoardViewPreferences) => {
      const previous = utils.board.get.getData({ boardId });
      const current = previous?.viewPreferences ?? preferences;
      const next = getNext(current);
      save.mutate({ boardId, ...next });
    },
    [boardId, preferences, save, utils.board.get],
  );

  const setColumnSort = useCallback(
    (columnId: string, mode: ColumnSortMode, dir: ColumnSortDir) => {
      update((current) => ({
        ...current,
        sorts: { ...current.sorts, [columnId]: { mode, dir } },
      }));
    },
    [update],
  );

  const setColumnHidden = useCallback(
    (columnId: string, hidden: boolean) => {
      update((current) => ({
        ...current,
        hiddenColumnIds: hidden
          ? [...new Set([...current.hiddenColumnIds, columnId])]
          : current.hiddenColumnIds.filter((id) => id !== columnId),
      }));
    },
    [update],
  );

  const setColumnCollapsed = useCallback(
    (columnId: string, collapsed: boolean) => {
      update((current) => ({
        ...current,
        collapsedColumnIds: collapsed
          ? [...new Set([...current.collapsedColumnIds, columnId])]
          : current.collapsedColumnIds.filter((id) => id !== columnId),
      }));
    },
    [update],
  );

  const setDefaultColumnId = useCallback(
    (columnId: string | null) => {
      update((current) => ({ ...current, defaultColumnId: columnId }));
    },
    [update],
  );

  const setMilestoneFilter = useCallback(
    (milestoneFilter: string | null) => {
      update((current) => ({ ...current, milestoneFilter }));
    },
    [update],
  );

  return {
    preferences,
    setMilestoneFilter,
    setColumnSort,
    setColumnHidden,
    setColumnCollapsed,
    setDefaultColumnId,
  };
}
