import * as SecureStore from "expo-secure-store";

export { parsePairPayload, type PairPayload } from "@kanbi/shared";

const KEY = "kanbi-focus-config-v2";
const LEGACY_KEY = "kanbi-focus-config-v1";

export interface PersistedConfig {
  baseUrl: string;
  deviceToken: string;
  deviceId: string;
  /** Board the user picked to focus on. Null = pick first / show picker. */
  boardId: string | null;
  preferredColumn: string | null;
}

export async function loadConfig(): Promise<PersistedConfig | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) {
    // Old single-board config is incompatible with v2; nuke it.
    await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => {});
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PersistedConfig;
    if (!parsed.baseUrl || !parsed.deviceToken || !parsed.deviceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveConfig(config: PersistedConfig): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(config));
}

export async function clearConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
  await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => {});
}
