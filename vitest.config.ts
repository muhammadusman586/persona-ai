import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` throws when imported outside a React Server environment;
      // stub it so server-only modules can be unit-tested under Vitest.
      "server-only": path.resolve(__dirname, "test/stubs/empty.ts"),
    },
  },
});
