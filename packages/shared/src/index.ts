export * from "./datetime";

/**
 * Payload encoded into the QR code by the web app's pair-focus-dialog
 * and consumed by the kanbi-focus Expo client. v2 hands the device a
 * personal bearer token so it can read whichever boards the user can
 * access — bumping `v` is a breaking change for the mobile scanner,
 * keep web and focus in sync.
 */
export interface PairPayload {
  v: 2;
  baseUrl: string;
  deviceToken: string;
  deviceId: string;
}

export function parsePairPayload(raw: string): PairPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PairPayload>;
    if (
      parsed.v === 2 &&
      typeof parsed.baseUrl === "string" &&
      parsed.baseUrl.length > 0 &&
      typeof parsed.deviceToken === "string" &&
      parsed.deviceToken.length > 0 &&
      typeof parsed.deviceId === "string" &&
      parsed.deviceId.length > 0
    ) {
      return {
        v: 2,
        baseUrl: parsed.baseUrl,
        deviceToken: parsed.deviceToken,
        deviceId: parsed.deviceId,
      };
    }
    return null;
  } catch {
    return null;
  }
}
