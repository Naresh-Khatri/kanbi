import "server-only";

import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  wrapLanguageModel,
  type LanguageModel,
  type LanguageModelMiddleware,
} from "ai";

import { env } from "@/env";

type Model = Exclude<LanguageModel, string>;

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured: set GROQ_API_KEY or OPENROUTER_API_KEY");
  }
}

// reasoning burns tokens + latency on short json drafts -> keep it minimal
function groqEffort(reasoningEffort: "none" | "low"): LanguageModelMiddleware {
  return {
    middlewareVersion: "v2",
    transformParams: async ({ params }) => ({
      ...params,
      providerOptions: {
        ...params.providerOptions,
        groq: { ...params.providerOptions?.groq, reasoningEffort },
      },
    }),
  };
}

function fallbackTo(next: Model, label: string): LanguageModelMiddleware {
  return {
    middlewareVersion: "v2",
    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        return await doGenerate();
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[ai] ${label} failed, falling back: ${reason}`);
        return next.doGenerate(params);
      }
    },
  };
}

function buildChain(): Model | null {
  // [model, middleware, label] in preference order
  const chain: [Model, LanguageModelMiddleware[], string][] = [];

  if (env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: env.GROQ_API_KEY });
    // free limits are per model (200k tokens/day each) -> stacking = 600k/day; exhausted -> fast 429
    chain.push([
      groq("openai/gpt-oss-20b"),
      [groqEffort("low")],
      "gpt-oss-20b",
    ]);
    chain.push([
      groq("openai/gpt-oss-120b"),
      [groqEffort("low")],
      "gpt-oss-120b",
    ]);
    // preview model: may get pulled -> 404 just falls through
    chain.push([groq("qwen/qwen3.8-27b"), [groqEffort("none")], "qwen3.8-27b"]);
  }

  if (env.OPENROUTER_API_KEY) {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      supportsStructuredOutputs: true,
      // only route to providers that honor json_schema
      transformRequestBody: (body) => ({
        ...body,
        provider: { require_parameters: true },
      }),
    });
    // $0 router over whatever :free models exist (list churns); 50 req/day per account, 1k once $10 bought
    chain.push([openrouter("openrouter/free"), [], "openrouter/free"]);
  }

  return chain.reduceRight<Model | null>(
    (next, [model, middleware, label]) =>
      wrapLanguageModel({
        model,
        middleware: next
          ? [...middleware, fallbackTo(next, label)]
          : middleware,
      }),
    null,
  );
}

let cached: Model | null = null;

export function draftModel(): Model {
  cached ??= buildChain();
  if (!cached) throw new AiNotConfiguredError();
  return cached;
}
