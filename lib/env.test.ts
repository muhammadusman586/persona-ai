import { describe, it, expect, afterEach } from "vitest";
import { getEnv } from "@/lib/env";

describe("getEnv", () => {
  afterEach(() => {
    delete process.env.TEST_ONLY_VAR;
  });

  it("returns the value when set", () => {
    process.env.TEST_ONLY_VAR = "hello";
    expect(getEnv("TEST_ONLY_VAR")).toBe("hello");
  });

  it("throws when missing", () => {
    expect(() => getEnv("TEST_ONLY_VAR")).toThrow("Missing env var: TEST_ONLY_VAR");
  });
});
