export type ChatRole = "user" | "assistant";

export interface HistoryMessage {
  role: ChatRole;
  content: string;
}

export const CONTEXT_WINDOW = 16;

export function buildContext(
  history: HistoryMessage[],
  windowSize: number = CONTEXT_WINDOW,
): HistoryMessage[] {
  if (history.length <= windowSize) {
    return [...history];
  }
  return history.slice(history.length - windowSize);
}
