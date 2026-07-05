import { describe, it, expect } from "vitest";
import { getPersona, isPersonaId, PERSONAS } from "@/lib/ai/personas";

describe("persona registry", () => {
  it("returns the Hitesh persona", () => {
    expect(getPersona("hitesh").name).toBe("Hitesh Choudhary");
  });

  it("returns the Piyush persona", () => {
    expect(getPersona("piyush").name).toBe("Piyush Garg");
  });

  it("throws on an unknown persona", () => {
    expect(() => getPersona("elon")).toThrow("Unknown persona: elon");
  });

  it("validates persona ids", () => {
    expect(isPersonaId("hitesh")).toBe(true);
    expect(isPersonaId("nope")).toBe(false);
  });

  it("every persona has at least 3 few-shot examples", () => {
    for (const persona of Object.values(PERSONAS)) {
      expect(persona.fewShot.length).toBeGreaterThanOrEqual(3);
    }
  });
});
