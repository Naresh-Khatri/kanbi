/**
 * Minimal typed client for the kanbi web app's `focus.peek` public route.
 *
 * The web app uses superjson + the standard tRPC `/api/trpc/<path>` HTTP
 * convention. We hit it directly to avoid pulling AppRouter and its server
 * dependencies into the Expo bundle.
 */

export type FocusPriority = "urgent" | "high" | "medium" | "low" | "none";

export interface FocusTask {
  id: string;
  title: string;
  columnId: string;
  priority: FocusPriority;
  position: number;
  dueAt: string | null;
}

export interface FocusColumn {
  id: string;
  name: string;
  position: number;
}

export interface FocusBoard {
  id: string;
  projectName: string;
}

export interface FocusPeek {
  board: FocusBoard;
  columns: FocusColumn[];
  tasks: FocusTask[];
  fetchedAt: string;
}

interface TrpcSuccess<T> {
  result: { data: { json: T; meta?: unknown } };
}

interface TrpcError {
  error: {
    json: {
      message: string;
      code: number;
      data: { code: string; httpStatus: number; path?: string };
    };
  };
}

export class FocusApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface FocusConfig {
  baseUrl: string;
  shareToken: string;
}

export async function fetchFocusPeek(
  config: FocusConfig,
  signal?: AbortSignal,
): Promise<FocusPeek> {
  const input = encodeURIComponent(
    JSON.stringify({ json: { token: config.shareToken } }),
  );
  const url = `${trimSlash(config.baseUrl)}/api/trpc/focus.peek?input=${input}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "content-type": "application/json" },
    signal,
  });

  const body = (await res.json()) as TrpcSuccess<FocusPeek> | TrpcError;
  if (!res.ok || "error" in body) {
    const err = "error" in body ? body.error.json : null;
    throw new FocusApiError(
      err?.message ?? `HTTP ${res.status}`,
      res.status,
      err?.data.code ?? "UNKNOWN",
    );
  }
  return body.result.data.json;
}

function trimSlash(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
