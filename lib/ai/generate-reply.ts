import { getPersona } from "@/lib/ai/personas";
import { buildSystemPrompt } from "@/lib/ai/build-system-prompt";
import { buildContext, type HistoryMessage } from "@/lib/ai/build-context";
import { getOpenAI, MODEL } from "@/lib/ai/openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function defaultCreateCompletion(messages: ChatMessage[]): Promise<string> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages,
  });
  return response.choices[0]?.message?.content ?? "";
}

export async function generateReply(
  args: { personaId: string; history: HistoryMessage[] },
  deps: { createCompletion?: (messages: ChatMessage[]) => Promise<string> } = {},
): Promise<string> {
  const persona = getPersona(args.personaId);
  const createCompletion = deps.createCompletion ?? defaultCreateCompletion;

  const windowed = buildContext(args.history);
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(persona) },
    ...windowed.map((m) => ({ role: m.role, content: m.content })),
  ];

  return createCompletion(messages);
}
