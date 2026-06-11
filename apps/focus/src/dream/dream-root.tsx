import { useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { formatDate } from "@kanbi/shared";

import { fetchBoardSnapshot, FocusApiError } from "@/lib/trpc";
import { loadConfig } from "@/lib/storage";
import { pickActiveTask, priorityColor } from "@/lib/active-task";
import { formatClock, usePomodoro } from "@/lib/pomodoro";
import { PomodoroRing } from "@/components/pomodoro-ring";

const queryClient = new QueryClient();

/**
 * Root component handed to ReactRootView by KanbiDreamService. Mirrors the
 * docked focus screen but skips the navigation chrome — the system controls
 * lifecycle, so there's no Boards / Settings to surface here. Polling is
 * fixed at the docked cadence since DreamService only runs while docked.
 */
export function DreamRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <DreamSurface />
    </QueryClientProvider>
  );
}

function DreamSurface() {
  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: () => loadConfig(),
    staleTime: Infinity,
  });

  const snapshot = useQuery({
    queryKey: [
      "dream.boardSnapshot",
      configQuery.data?.deviceToken,
      configQuery.data?.boardId,
    ],
    enabled: !!configQuery.data?.boardId,
    queryFn: ({ signal }) =>
      fetchBoardSnapshot(
        {
          baseUrl: configQuery.data!.baseUrl,
          deviceToken: configQuery.data!.deviceToken,
        },
        configQuery.data!.boardId!,
        signal,
      ),
    refetchInterval: 15_000,
  });

  const pomodoro = usePomodoro();

  const active = useMemo(() => {
    if (!snapshot.data) return null;
    return pickActiveTask(
      snapshot.data,
      configQuery.data?.preferredColumn ?? null,
    );
  }, [snapshot.data, configQuery.data?.preferredColumn]);

  useEffect(() => {
    pomodoro.start();
  }, []);

  if (configQuery.isLoading || !configQuery.data) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!configQuery.data.boardId) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-10">
        <Text className="text-base text-zinc-400">
          Open Kanbi Focus to pick a board.
        </Text>
      </View>
    );
  }

  const progress =
    pomodoro.totalMs > 0 ? 1 - pomodoro.remainingMs / pomodoro.totalMs : 0;
  const ringColor =
    pomodoro.phase === "focus"
      ? "#22d3ee"
      : pomodoro.phase === "short-break"
        ? "#a3e635"
        : "#f472b6";

  return (
    <View className="flex-1 flex-row bg-black px-10 py-6">
      <View className="flex-1 justify-between pr-8">
        <View>
          <Text className="text-xs uppercase tracking-[3px] text-zinc-500">
            {snapshot.data?.board.projectName ?? "Kanbi"}
          </Text>
          <Text className="mt-2 text-[10px] uppercase tracking-widest text-zinc-500">
            Docked · {active?.column?.name ?? "—"}
          </Text>
        </View>

        <View>
          {snapshot.isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : snapshot.error ? (
            <Text className="text-base text-red-400">
              {snapshot.error instanceof FocusApiError
                ? `${snapshot.error.code}: ${snapshot.error.message}`
                : "Failed to load tasks"}
            </Text>
          ) : !active?.task ? (
            <Text className="text-2xl text-zinc-400">No active tasks.</Text>
          ) : (
            <>
              <View className="mb-3 flex-row items-center gap-3">
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: priorityColor(active.task.priority),
                  }}
                />
                <Text className="text-xs uppercase tracking-widest text-zinc-400">
                  {active.task.priority === "none"
                    ? "no priority"
                    : active.task.priority}
                </Text>
              </View>
              <Text
                className="text-5xl font-semibold leading-tight text-white"
                numberOfLines={3}
              >
                {active.task.title}
              </Text>
              {active.task.dueAt ? (
                <Text className="mt-3 text-sm text-zinc-400">
                  due {formatDate(active.task.dueAt)}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <Text className="text-[10px] uppercase tracking-widest text-zinc-600">
          cycle {pomodoro.cyclesCompleted} · {pomodoro.phase}
        </Text>
      </View>

      <View className="w-px bg-zinc-900" />

      <View className="flex-1 items-center justify-center pl-8">
        <PomodoroRing progress={progress} color={ringColor}>
          <Text className="font-mono text-6xl text-white">
            {formatClock(pomodoro.remainingMs)}
          </Text>
          <Text className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">
            {pomodoro.phase === "focus"
              ? "focus"
              : pomodoro.phase === "short-break"
                ? "break"
                : "long break"}
          </Text>
        </PomodoroRing>

        <View className="mt-8 flex-row gap-3">
          {pomodoro.state === "running" ? (
            <Pressable
              onPress={pomodoro.pause}
              className="rounded-md bg-white px-5 py-2.5"
            >
              <Text className="text-sm font-semibold uppercase tracking-widest text-black">
                Pause
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={pomodoro.start}
              className="rounded-md bg-white px-5 py-2.5"
            >
              <Text className="text-sm font-semibold uppercase tracking-widest text-black">
                {pomodoro.state === "paused" ? "Resume" : "Start"}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={pomodoro.skip}
            className="rounded-md border border-zinc-800 px-5 py-2.5"
          >
            <Text className="text-sm font-semibold uppercase tracking-widest text-zinc-300">
              Skip
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
