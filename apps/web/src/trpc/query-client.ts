import {
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

type AuthHooks = {
  onError: (error: unknown, source: "query" | "mutation") => void;
  onSuccess: () => void;
};

// hooks injected by the browser provider; server.ts imports this too
export const createQueryClient = (auth?: AuthHooks) =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (e) => auth?.onError(e, "query"),
      onSuccess: () => auth?.onSuccess(),
    }),
    mutationCache: new MutationCache({
      onError: (e) => auth?.onError(e, "mutation"),
      onSuccess: () => auth?.onSuccess(),
    }),
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
