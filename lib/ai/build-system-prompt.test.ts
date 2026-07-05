import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/ai/build-system-prompt";
import { getPersona } from "@/lib/ai/personas";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt(getPersona("hitesh"));

  it("includes the persona name and bio", () => {
    expect(prompt).toContain("Hitesh Choudhary");
    expect(prompt).toContain("chai aur code");
  });

  it("includes voice, teaching, and guardrail rules", () => {
    expect(prompt).toContain("Haan ji");
    expect(prompt.toLowerCase()).toContain("stay in character");
  });

  it("includes few-shot examples with user and assistant turns", () => {
    const p = getPersona("hitesh");
    expect(prompt).toContain(p.fewShot[0].user);
    expect(prompt).toContain(p.fewShot[0].assistant);
  });
});
