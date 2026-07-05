import { describe, it, expect, vi } from "vitest";
import { generateReply, type ChatMessage } from "@/lib/ai/generate-reply";
import type { HistoryMessage } from "@/lib/ai/build-context";

describe("generateReply", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "What is a closure?" },
  ];

  it("puts the persona system prompt first and passes the history", async () => {
    const createCompletion = vi.fn<(messages: ChatMessage[]) => Promise<string>>(
      async () => "reply text",
    );
    const reply = await generateReply(
      { personaId: "hitesh", history },
      { createCompletion },
    );

    expect(reply).toBe("reply text");
    const messages = createCompletion.mock.calls[0][0];
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Hitesh Choudhary");
    expect(messages[messages.length - 1]).toEqual({
      role: "user",
      content: "What is a closure?",
    });
  });

  it("throws on an unknown persona", async () => {
    await expect(
      generateReply({ personaId: "ghost", history }),
    ).rejects.toThrow("Unknown persona: ghost");
  });
});
