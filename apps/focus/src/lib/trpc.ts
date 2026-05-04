/**
 * Minimal typed client for the kanbi web app's `focus.*` routes.
 *
 * Uses `Authorization: Bearer kbf_…` from the paired device token, so the
 * mobile client can hit the same protected procedures as the web app.
 */

export type FocusPriority = "urgent" | "high" | "medium" | "low" | "none";

export interface FocusTask {
  id: string;
  title: string;
  columnId: string;
  priority: FocusPriority;
  position: number;
  dueAt: string | null;
  assigneeId: string | null;
}

export interface FocusColumn {
  id: string;
  name: string;
  position: number;
}

export interface FocusBoardListEntry {
  boardId: string;
  project: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string | null;
  };
}

export interface FocusBoardSnapshot {
  board: {
    id: string;
    projectId: string;
    projectName: string;
    projectSlug: string;
  };
  columns: FocusColumn[];
  tasks: FocusTask[];
  fetchedAt: string;
}

export interface FocusMe {
  id: string;
  name: string;
  email: string;
  image: string | null;
  via: "device" | "session";
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

export interface FocusAuth {
  baseUrl: string;
  deviceToken: string;
}

async function trpcGet<T>(
  auth: FocusAuth,
  path: string,
  input: Record<string, unknown> | undefined,
  signal: AbortSignal | undefined,
): Promise<T> {
  const url = new URL(`${trimSlash(auth.baseUrl)}/api/trpc/${path}`);
  if (input !== undefined) {
    url.searchParams.set("input", JSON.stringify({ json: input }));
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.deviceToken}`,
    },
    signal,
  });
  const body = (await res.json()) as TrpcSuccess<T> | TrpcError;
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

export const fetchFocusMe = (auth: FocusAuth, signal?: AbortSignal) =>
  trpcGet<FocusMe>(auth, "focus.me", undefined, signal);

export const fetchFocusBoards = (auth: FocusAuth, signal?: AbortSignal) =>
  trpcGet<FocusBoardListEntry[]>(auth, "focus.listBoards", undefined, signal);

export const fetchBoardSnapshot = (
  auth: FocusAuth,
  boardId: string,
  signal?: AbortSignal,
) => trpcGet<FocusBoardSnapshot>(auth, "focus.boardSnapshot", { boardId }, signal);

function trimSlash(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
