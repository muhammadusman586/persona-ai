import { describe, it, expect } from "vitest";
import { buildContext, CONTEXT_WINDOW, type HistoryMessage } from "@/lib/ai/build-context";

function makeHistory(n: number): HistoryMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `msg-${i}`,
  }));
}

describe("buildContext", () => {
  it("returns all messages when under the window", () => {
    const history = makeHistory(4);
    expect(buildContext(history)).toHaveLength(4);
  });

  it("caps at the window size, keeping the most recent", () => {
    const history = makeHistory(CONTEXT_WINDOW + 10);
    const result = buildContext(history);
    expect(result).toHaveLength(CONTEXT_WINDOW);
    expect(result[result.length - 1].content).toBe(`msg-${CONTEXT_WINDOW + 9}`);
    expect(result[0].content).toBe(`msg-10`);
  });

  it("respects a custom window size", () => {
    const history = makeHistory(10);
    expect(buildContext(history, 3)).toHaveLength(3);
  });

  it("preserves chronological order", () => {
    const result = buildContext(makeHistory(3));
    expect(result.map((m) => m.content)).toEqual(["msg-0", "msg-1", "msg-2"]);
  });
});
