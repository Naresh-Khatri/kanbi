"use client";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  httpBatchStreamLink,
  httpSubscriptionLink,
  loggerLink,
  splitLink,
} from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import SuperJSON from "superjson";

import {
  isUnauthorized,
  onSessionExpired,
  onSessionOk,
} from "@/lib/session-expiry";
import type { AppRouter } from "@/server/api/root";
import { createQueryClient } from "./query-client";

const authHooks = {
  onError: (error: unknown, source: "query" | "mutation") => {
    if (isUnauthorized(error)) onSessionExpired(source);
  },
  onSuccess: onSessionOk,
};

let clientQueryClientSingleton: QueryClient | undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  clientQueryClientSingleton ??= createQueryClient(authHooks);

  return clientQueryClientSingleton;
};

export const api = createTRPCReact<AppRouter>();

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        splitLink({
          condition: (op) => op.type === "subscription",
          true: httpSubscriptionLink({
            transformer: SuperJSON,
            url: `${getBaseUrl()}/api/trpc`,
          }),
          false: httpBatchStreamLink({
            transformer: SuperJSON,
            url: `${getBaseUrl()}/api/trpc`,
            fetch: guardedFetch,
            headers: () => {
              const headers = new Headers();
              headers.set("x-trpc-source", "nextjs-react");
              return headers;
            },
          }),
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

// proxy/gateway error pages are HTML -> tRPC would surface the raw markup as the message
async function guardedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) {
    throw new Error(
      `Kanbi couldn't be reached (${res.status}). Please try again in a moment.`,
    );
  }
  return res;
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3333}`;
}
