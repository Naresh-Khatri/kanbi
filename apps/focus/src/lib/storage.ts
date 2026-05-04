import * as SecureStore from "expo-secure-store";

export { parsePairPayload, type PairPayload } from "@kanbi/shared";

const KEY = "kanbi-focus-config-v1";

export interface PersistedConfig {
  baseUrl: string;
  shareToken: string;
  preferredColumn: string | null;
}

export async function loadConfig(): Promise<PersistedConfig | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedConfig;
    if (!parsed.baseUrl || !parsed.shareToken) return null;
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
}
