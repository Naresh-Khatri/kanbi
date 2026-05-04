import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  clearConfig,
  loadConfig,
  saveConfig,
  type PersistedConfig,
} from "@/lib/storage";
import {
  fetchBoardSnapshot,
  fetchFocusMe,
  FocusApiError,
} from "@/lib/trpc";

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const existing = useQuery({
    queryKey: ["config"],
    queryFn: () => loadConfig(),
    staleTime: Infinity,
  });

  const [config, setConfig] = useState<PersistedConfig | null>(null);
  const [testing, setTesting] = useState(false);
  const [columns, setColumns] = useState<{ id: string; name: string }[]>([]);
  const [whoami, setWhoami] = useState<string | null>(null);

  useEffect(() => {
    setConfig(existing.data ?? null);
  }, [existing.data]);

  const handleTest = async () => {
    if (!config) return;
    setTesting(true);
    try {
      const me = await fetchFocusMe({
        baseUrl: config.baseUrl,
        deviceToken: config.deviceToken,
      });
      setWhoami(`${me.name} (${me.email})`);
      if (config.boardId) {
        const snap = await fetchBoardSnapshot(
          { baseUrl: config.baseUrl, deviceToken: config.deviceToken },
          config.boardId,
        );
        setColumns(snap.columns.map((c) => ({ id: c.id, name: c.name })));
      }
    } catch (e) {
      const message =
        e instanceof FocusApiError
          ? `${e.code}: ${e.message}`
          : (e as Error).message;
      Alert.alert("Connection failed", message);
    } finally {
      setTesting(false);
    }
  };

  const handleReset = async () => {
    await clearConfig();
    queryClient.setQueryData(["config"], null);
    setConfig(null);
    setColumns([]);
    setWhoami(null);
    router.replace("/pair");
  };

  const updatePreferredColumn = async (preferredColumn: string | null) => {
    if (!config) return;
    const next = { ...config, preferredColumn };
    await saveConfig(next);
    setConfig(next);
    queryClient.setQueryData(["config"], next);
  };

  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerStyle={{ padding: 32 }}
    >
      <Text className="text-2xl font-semibold text-white">Kanbi Focus</Text>
      <Text className="mt-1 text-sm text-zinc-500">
        Paired devices read whichever board you pick. Re-pair from the web app
        in Profile → Focus devices.
      </Text>

      <View className="mt-6 rounded-md border border-zinc-800 px-4 py-3">
        <Text className="text-[10px] uppercase tracking-widest text-zinc-500">
          Status
        </Text>
        {config ? (
          <>
            <Text className="mt-1 text-sm text-white">
              {config.baseUrl}
            </Text>
            <Text className="text-[11px] text-zinc-500">
              token …{config.deviceToken.slice(-6)} · device {config.deviceId}
            </Text>
            <Text className="text-[11px] text-zinc-500">
              board: {config.boardId ?? "—"}
            </Text>
            {whoami ? (
              <Text className="mt-1 text-[11px] text-emerald-400">
                signed in as {whoami}
              </Text>
            ) : null}
          </>
        ) : (
          <Text className="mt-1 text-sm text-zinc-400">Not paired.</Text>
        )}
      </View>

      <View className="mt-5 flex-row flex-wrap gap-3">
        <Pressable
          onPress={() => router.push("/pair")}
          className="rounded-md bg-white px-4 py-2"
        >
          <Text className="text-xs font-semibold uppercase tracking-widest text-black">
            Re-pair via QR
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/boards")}
          className="rounded-md border border-zinc-800 px-4 py-2"
          disabled={!config}
        >
          <Text className="text-xs uppercase tracking-widest text-zinc-300">
            Pick board
          </Text>
        </Pressable>
        <Pressable
          disabled={testing || !config}
          onPress={handleTest}
          className="rounded-md border border-zinc-800 px-4 py-2"
        >
          {testing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-xs uppercase tracking-widest text-zinc-300">
              Test connection
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={handleReset}
          className="rounded-md border border-zinc-800 px-4 py-2"
        >
          <Text className="text-xs uppercase tracking-widest text-zinc-300">
            Sign out
          </Text>
        </Pressable>
      </View>

      {columns.length > 0 ? (
        <View className="mt-8">
          <Text className="text-[10px] uppercase tracking-widest text-zinc-500">
            Preferred column (optional)
          </Text>
          <Text className="mt-1 text-xs text-zinc-600">
            If unset, the app picks the top of an in-progress column, then todo,
            then anything.
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => updatePreferredColumn(null)}
              className={`rounded-md border px-3 py-1.5 ${
                !config?.preferredColumn
                  ? "border-white bg-white"
                  : "border-zinc-800"
              }`}
            >
              <Text
                className={`text-xs uppercase tracking-widest ${
                  !config?.preferredColumn ? "text-black" : "text-zinc-300"
                }`}
              >
                Auto
              </Text>
            </Pressable>
            {columns.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => updatePreferredColumn(c.id)}
                className={`rounded-md border px-3 py-1.5 ${
                  config?.preferredColumn === c.id
                    ? "border-white bg-white"
                    : "border-zinc-800"
                }`}
              >
                <Text
                  className={`text-xs uppercase tracking-widest ${
                    config?.preferredColumn === c.id
                      ? "text-black"
                      : "text-zinc-300"
                  }`}
                >
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
