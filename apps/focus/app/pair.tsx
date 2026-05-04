import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { fetchFocusPeek, FocusApiError } from "@/lib/trpc";
import { parsePairPayload, saveConfig } from "@/lib/storage";

type Status =
  | { kind: "idle" }
  | { kind: "verifying"; baseUrl: string }
  | { kind: "error"; message: string };

export default function PairScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const queryClient = useQueryClient();
  const lockRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScan = async ({ data }: BarcodeScanningResult) => {
    if (lockRef.current) return;
    const payload = parsePairPayload(data);
    if (!payload) {
      setStatus({
        kind: "error",
        message: "Not a Kanbi pairing code.",
      });
      return;
    }

    lockRef.current = true;
    setStatus({ kind: "verifying", baseUrl: payload.baseUrl });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );

    try {
      await fetchFocusPeek({
        baseUrl: payload.baseUrl,
        shareToken: payload.token,
      });
      const config = {
        baseUrl: payload.baseUrl,
        shareToken: payload.token,
        preferredColumn: null,
      };
      await saveConfig(config);
      queryClient.setQueryData(["config"], config);
      queryClient.invalidateQueries({ queryKey: ["focus.peek"] });
      router.replace("/");
    } catch (e) {
      lockRef.current = false;
      const message =
        e instanceof FocusApiError
          ? `${e.code}: ${e.message}`
          : `Couldn't reach ${payload.baseUrl}. Make sure the phone is on the same network.`;
      setStatus({ kind: "error", message });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-12">
        <Text className="text-center text-base text-zinc-300">
          Camera permission is needed to scan the pairing QR code.
        </Text>
        <Pressable
          onPress={() => requestPermission()}
          className="mt-4 rounded-md bg-white px-5 py-2.5"
        >
          <Text className="text-sm font-semibold uppercase tracking-widest text-black">
            Grant access
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace("/settings")}
          className="mt-3 rounded-md border border-zinc-800 px-5 py-2.5"
        >
          <Text className="text-xs uppercase tracking-widest text-zinc-300">
            Enter manually
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={status.kind === "verifying" ? undefined : handleScan}
      />
      <View className="absolute inset-0 items-center justify-between px-10 py-10">
        <View className="self-start">
          <Text className="text-[10px] uppercase tracking-[3px] text-white/80">
            Kanbi · Pair
          </Text>
          <Text className="mt-1 text-base text-white/90">
            Scan the QR from board → settings → Sharing.
          </Text>
        </View>

        <View className="h-64 w-64 rounded-2xl border-2 border-white/70" />

        <View className="w-full">
          {status.kind === "verifying" ? (
            <View className="flex-row items-center justify-center gap-3 rounded-md bg-black/60 px-4 py-3">
              <ActivityIndicator color="#fff" />
              <Text className="text-sm text-white">
                Verifying {status.baseUrl}…
              </Text>
            </View>
          ) : status.kind === "error" ? (
            <View className="flex-row items-center justify-between gap-3 rounded-md bg-black/60 px-4 py-3">
              <Text className="flex-1 text-sm text-red-300">
                {status.message}
              </Text>
              <Pressable
                onPress={() => {
                  lockRef.current = false;
                  setStatus({ kind: "idle" });
                }}
                className="rounded-md border border-white/40 px-3 py-1.5"
              >
                <Text className="text-xs uppercase tracking-widest text-white">
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => router.replace("/settings")}
              className="self-center rounded-md border border-white/40 px-4 py-2"
            >
              <Text className="text-xs uppercase tracking-widest text-white">
                Enter manually
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
