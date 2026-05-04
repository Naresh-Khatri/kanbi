import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Redirect, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchFocusBoards, FocusApiError } from "@/lib/trpc";
import { loadConfig, saveConfig } from "@/lib/storage";

export default function BoardsScreen() {
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => loadConfig(),
    staleTime: Infinity,
  });

  const boards = useQuery({
    queryKey: ["focus.listBoards"],
    enabled: !!config.data,
    queryFn: ({ signal }) =>
      fetchFocusBoards(
        {
          baseUrl: config.data!.baseUrl,
          deviceToken: config.data!.deviceToken,
        },
        signal,
      ),
  });

  if (config.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (!config.data) return <Redirect href="/pair" />;

  const pick = async (boardId: string, preferredColumn: string | null) => {
    const next = { ...config.data!, boardId, preferredColumn };
    await saveConfig(next);
    queryClient.setQueryData(["config"], next);
    queryClient.invalidateQueries({ queryKey: ["focus.boardSnapshot"] });
    router.replace("/");
  };

  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerStyle={{ padding: 32 }}
    >
      <Text className="text-2xl font-semibold text-white">Pick a board</Text>
      <Text className="mt-1 text-sm text-zinc-500">
        Focus shows one board at a time. Swap any time from Settings.
      </Text>

      {boards.isLoading ? (
        <View className="mt-8 items-center">
          <ActivityIndicator color="#fff" />
        </View>
      ) : boards.error ? (
        <Text className="mt-8 text-base text-red-400">
          {boards.error instanceof FocusApiError
            ? `${boards.error.code}: ${boards.error.message}`
            : "Failed to load boards"}
        </Text>
      ) : !boards.data || boards.data.length === 0 ? (
        <Text className="mt-8 text-base text-zinc-400">
          No boards yet. Create a project on the web first.
        </Text>
      ) : (
        <View className="mt-6 gap-2">
          {boards.data.map((b) => (
            <Pressable
              key={b.boardId}
              onPress={() => pick(b.boardId, null)}
              className={`rounded-lg border px-4 py-3 ${
                config.data?.boardId === b.boardId
                  ? "border-white bg-white/5"
                  : "border-zinc-800"
              }`}
            >
              <Text className="text-base text-white">{b.project.name}</Text>
              <Text className="text-[11px] uppercase tracking-widest text-zinc-500">
                {b.project.slug}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => router.replace("/settings")}
        className="mt-8 self-start rounded-md border border-zinc-800 px-4 py-2"
      >
        <Text className="text-xs uppercase tracking-widest text-zinc-300">
          Settings
        </Text>
      </Pressable>
    </ScrollView>
  );
}
