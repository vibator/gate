import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["packages/*/src/**/*.test.ts"],
    testTimeout: 60000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      reportOnFailure: true,
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts"],
    },
  },
});
