import OpenAI from "openai";
import { getEnv } from "@/lib/env";

export const MODEL = "gpt-4o";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: getEnv("OPENAI_API_KEY") });
  }
  return client;
}
