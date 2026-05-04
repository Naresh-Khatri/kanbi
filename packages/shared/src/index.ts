/**
 * Payload encoded into the QR code by the web app's pair-focus-dialog
 * and consumed by the kanbi-focus Expo client. Bumping `v` is a breaking
 * change for the mobile scanner — keep web and focus in sync.
 */
export interface PairPayload {
  v: 1;
  baseUrl: string;
  token: string;
}

export function parsePairPayload(raw: string): PairPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PairPayload>;
    if (
      parsed.v === 1 &&
      typeof parsed.baseUrl === "string" &&
      parsed.baseUrl.length > 0 &&
      typeof parsed.token === "string" &&
      parsed.token.length > 0
    ) {
      return { v: 1, baseUrl: parsed.baseUrl, token: parsed.token };
    }
    return null;
  } catch {
    return null;
  }
}
