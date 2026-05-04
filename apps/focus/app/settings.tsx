import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
import { fetchFocusPeek, FocusApiError } from "@/lib/trpc";

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const existing = useQuery({
    queryKey: ["config"],
    queryFn: () => loadConfig(),
    staleTime: Infinity,
  });

  const [baseUrl, setBaseUrl] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [preferredColumn, setPreferredColumn] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [columns, setColumns] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!existing.data) return;
    setBaseUrl(existing.data.baseUrl);
    setShareToken(existing.data.shareToken);
    setPreferredColumn(existing.data.preferredColumn);
  }, [existing.data]);

  const handleTest = async () => {
    if (!baseUrl || !shareToken) {
      Alert.alert("Missing fields", "Set both base URL and share token.");
      return;
    }
    setTesting(true);
    try {
      const peek = await fetchFocusPeek({ baseUrl, shareToken });
      setColumns(peek.columns.map((c) => ({ id: c.id, name: c.name })));
      Alert.alert(
        "Connected",
        `${peek.board.projectName}\n${peek.tasks.length} tasks visible`,
      );
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

  const handleSave = async () => {
    if (!baseUrl || !shareToken) {
      Alert.alert("Missing fields", "Set both base URL and share token.");
      return;
    }
    const config: PersistedConfig = {
      baseUrl: baseUrl.trim(),
      shareToken: shareToken.trim(),
      preferredColumn,
    };
    await saveConfig(config);
    queryClient.setQueryData(["config"], config);
    queryClient.invalidateQueries({ queryKey: ["focus.peek"] });
    router.replace("/");
  };

  const handleReset = async () => {
    await clearConfig();
    queryClient.setQueryData(["config"], null);
    setBaseUrl("");
    setShareToken("");
    setPreferredColumn(null);
    setColumns([]);
  };

  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerStyle={{ padding: 32 }}
    >
      <Text className="text-2xl font-semibold text-white">Kanbi Focus</Text>
      <Text className="mt-1 text-sm text-zinc-500">
        Point this device at a kanbi board via a share token.
      </Text>

      <View className="mt-6">
        <Text className="text-[10px] uppercase tracking-widest text-zinc-500">
          Base URL
        </Text>
        <TextInput
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder="http://192.168.1.10:3333"
          placeholderTextColor="#52525b"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-white"
        />
      </View>

      <View className="mt-4">
        <Text className="text-[10px] uppercase tracking-widest text-zinc-500">
          Share token
        </Text>
        <TextInput
          value={shareToken}
          onChangeText={setShareToken}
          placeholder="from board → share"
          placeholderTextColor="#52525b"
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-white"
        />
      </View>

      <View className="mt-5 flex-row gap-3">
        <Pressable
          onPress={() => router.push("/pair")}
          className="rounded-md bg-white px-4 py-2"
        >
          <Text className="text-xs font-semibold uppercase tracking-widest text-black">
            Pair via QR
          </Text>
        </Pressable>
        <Pressable
          disabled={testing}
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
          onPress={handleSave}
          className="rounded-md border border-zinc-800 px-4 py-2"
        >
          <Text className="text-xs uppercase tracking-widest text-zinc-300">
            Save & start
          </Text>
        </Pressable>
        <Pressable
          onPress={handleReset}
          className="rounded-md border border-zinc-800 px-4 py-2"
        >
          <Text className="text-xs uppercase tracking-widest text-zinc-300">
            Clear
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
              onPress={() => setPreferredColumn(null)}
              className={`rounded-md border px-3 py-1.5 ${
                preferredColumn == null
                  ? "border-white bg-white"
                  : "border-zinc-800"
              }`}
            >
              <Text
                className={`text-xs uppercase tracking-widest ${
                  preferredColumn == null ? "text-black" : "text-zinc-300"
                }`}
              >
                Auto
              </Text>
            </Pressable>
            {columns.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setPreferredColumn(c.id)}
                className={`rounded-md border px-3 py-1.5 ${
                  preferredColumn === c.id
                    ? "border-white bg-white"
                    : "border-zinc-800"
                }`}
              >
                <Text
                  className={`text-xs uppercase tracking-widest ${
                    preferredColumn === c.id ? "text-black" : "text-zinc-300"
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
