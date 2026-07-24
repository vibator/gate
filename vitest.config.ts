import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      reportOnFailure: true,
      include: ["packages/create-gate/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "packages/create-gate/src/cli.ts",
        "packages/create-gate/src/wizard.ts",
      ],
    },
  },
});
