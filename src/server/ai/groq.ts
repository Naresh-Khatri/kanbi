import "server-only";

import Groq from "groq-sdk";

import { env } from "@/env";

let cached: Groq | null = null;

export function getGroq(): Groq {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }
  if (!cached) cached = new Groq({ apiKey: env.GROQ_API_KEY });
  return cached;
}

export const GROQ_DRAFT_MODEL = "openai/gpt-oss-20b";
