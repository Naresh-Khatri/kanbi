import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import { Link, Redirect, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import KanbiDream from "kanbi-dream";

import { fetchBoardSnapshot, FocusApiError } from "@/lib/trpc";
import { loadConfig } from "@/lib/storage";
import { pickActiveTask, priorityColor } from "@/lib/active-task";
import { formatClock, usePomodoro } from "@/lib/pomodoro";
import { useChargingState } from "@/lib/dock-trigger";
import { PomodoroRing } from "@/components/pomodoro-ring";

export default function FocusScreen() {
  useKeepAwake();
  const isCharging = useChargingState();

  useEffect(() => {
    KanbiDream.setShowWhenLocked(true);
    KanbiDream.setTurnScreenOn(true);
  }, []);

  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: () => loadConfig(),
    staleTime: Infinity,
  });

  const snapshot = useQuery({
    queryKey: [
      "focus.boardSnapshot",
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
    refetchInterval: isCharging ? 15_000 : 60_000,
  });

  const pomodoro = usePomodoro((phase) => {
    Haptics.impactAsync(
      phase === "focus"
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});
  });

  const active = useMemo(() => {
    if (!snapshot.data) return null;
    return pickActiveTask(
      snapshot.data,
      configQuery.data?.preferredColumn ?? null,
    );
  }, [snapshot.data, configQuery.data?.preferredColumn]);

  // Bad token → drop to pairing.
  useEffect(() => {
    if (
      snapshot.error instanceof FocusApiError &&
      snapshot.error.code === "UNAUTHORIZED"
    ) {
      router.replace("/pair");
    }
  }, [snapshot.error]);

  if (configQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!configQuery.data) return <Redirect href="/pair" />;
  if (!configQuery.data.boardId) return <Redirect href="/boards" />;

  const progress =
    pomodoro.totalMs > 0
      ? 1 - pomodoro.remainingMs / pomodoro.totalMs
      : 0;
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
          <View className="mt-2 flex-row items-center gap-2">
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isCharging ? "#22c55e" : "#52525b",
              }}
            />
            <Text className="text-[10px] uppercase tracking-widest text-zinc-500">
              {isCharging ? "Docked" : "On battery"} ·{" "}
              {active?.column?.name ?? "—"}
            </Text>
          </View>
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
            <Text className="text-2xl text-zinc-400">No active tasks. </Text>
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
                  due {new Date(active.task.dueAt).toLocaleString()}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row gap-2">
            <Link href="/boards" asChild>
              <Pressable className="rounded-md border border-zinc-800 px-3 py-1.5">
                <Text className="text-xs uppercase tracking-widest text-zinc-400">
                  Boards
                </Text>
              </Pressable>
            </Link>
            <Link href="/settings" asChild>
              <Pressable className="rounded-md border border-zinc-800 px-3 py-1.5">
                <Text className="text-xs uppercase tracking-widest text-zinc-400">
                  Settings
                </Text>
              </Pressable>
            </Link>
          </View>
          <Text className="text-[10px] uppercase tracking-widest text-zinc-600">
            cycle {pomodoro.cyclesCompleted} · {pomodoro.phase}
          </Text>
        </View>
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
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                pomodoro.pause();
              }}
              className="rounded-md bg-white px-5 py-2.5"
            >
              <Text className="text-sm font-semibold uppercase tracking-widest text-black">
                Pause
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                pomodoro.start();
              }}
              className="rounded-md bg-white px-5 py-2.5"
            >
              <Text className="text-sm font-semibold uppercase tracking-widest text-black">
                {pomodoro.state === "paused" ? "Resume" : "Start"}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              pomodoro.skip();
            }}
            className="rounded-md border border-zinc-800 px-5 py-2.5"
          >
            <Text className="text-sm font-semibold uppercase tracking-widest text-zinc-300">
              Skip
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              pomodoro.reset();
            }}
            className="rounded-md border border-zinc-800 px-5 py-2.5"
          >
            <Text className="text-sm font-semibold uppercase tracking-widest text-zinc-300">
              Reset
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
