const DICEBEAR_BASE = "https://api.dicebear.com/9.x/lorelei/svg";

export const AVATAR_BG_COLORS = [
  "b6e3f4",
  "c0aede",
  "d1d4f9",
  "ffd5dc",
  "ffdfbf",
  "a7f3d0",
  "fde68a",
  "fca5a5",
] as const;

const DEFAULT_BG = AVATAR_BG_COLORS[0];

export function buildAvatarUrl(seed: string, bg: string) {
  const params = new URLSearchParams({
    seed: seed || "Kanbi",
    backgroundColor: bg || DEFAULT_BG,
  });
  return `${DICEBEAR_BASE}?${params.toString()}`;
}

export function parseAvatar(url: string | null | undefined) {
  if (!url?.startsWith(DICEBEAR_BASE)) return null;
  try {
    const u = new URL(url);
    return {
      seed: u.searchParams.get("seed") ?? "",
      bg: u.searchParams.get("backgroundColor") || DEFAULT_BG,
    };
  } catch {
    return null;
  }
}

// line-art on transparent bg is unreadable on dark surfaces -> legacy urls get a bg
export function normalizeAvatarUrl(url: string | null | undefined) {
  const parsed = parseAvatar(url);
  return parsed ? buildAvatarUrl(parsed.seed, parsed.bg) : url;
}

export function randomAvatar() {
  return {
    seed: String(Math.floor(Math.random() * 100)),
    bg: AVATAR_BG_COLORS[
      Math.floor(Math.random() * AVATAR_BG_COLORS.length)
    ] as string,
  };
}
