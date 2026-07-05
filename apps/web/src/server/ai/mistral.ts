import "server-only";

import { createMistral } from "@ai-sdk/mistral";

import { env } from "@/env";

let cached: ReturnType<typeof createMistral> | null = null;

function provider() {
  if (!env.MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY is not configured");
  }
  if (!cached) cached = createMistral({ apiKey: env.MISTRAL_API_KEY });
  return cached;
}

// small/fast/cheap -> fits structured-json drafting + digest.
// bump to "mistral-large-latest" only if quality proves insufficient
export function draftModel() {
  return provider()("mistral-small-latest");
}
