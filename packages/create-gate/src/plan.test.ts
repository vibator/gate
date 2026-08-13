import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { type Answers, plan } from "./plan.ts";

/** This package's manifest, the source of the version ranges the wizard writes. */
const manifest = createRequire(import.meta.url)("../package.json") as {
  peerDependencies: Record<string, string>;
};

/**
 * Builds answers with every gate enabled.
 *
 * @returns The answers.
 */
function everything(): Answers {
  return {
    tools: { biome: true, knip: true, depcruise: true, recommended: true },
    tsconfig: true,
  };
}

/**
 * The planned content of a file, parsed as JSON.
 *
 * @param answers - The wizard answers.
 * @param path - The planned file path.
 * @returns The parsed content.
 */
function planned(answers: Answers, path: string): Record<string, unknown> {
  const file = plan(answers).files.find((entry) => entry.path === path);
  if (!file) throw new Error(`no planned file at ${path}`);
  return JSON.parse(file.content) as Record<string, unknown>;
}

describe("plan", () => {
  it("plans the vibator config with the chosen plugins and rules", () => {
    const config = planned(everything(), ".vibator.json");
    expect(config.plugins).toEqual([
      "@vibator/biome",
      "@vibator/knip",
      "@vibator/depcruise",
      "@vibator/recommended",
    ]);
    const rules = config.rules as Record<string, unknown>;
    expect(rules.biome).toEqual({
      options: { configPath: ".vibator/biome.json", exclude: [] },
    });
    expect(rules.knip).toEqual({});
    expect(rules.depcruise).toEqual({
      options: { configPath: ".vibator/depcruise.cjs" },
    });
    expect(rules["tsdoc-coverage"]).toEqual({
      options: { include: ["src/**/*.{ts,tsx}"] },
    });
    expect(Object.keys(rules)).toContain("no-conflict-markers");
  });

  it("plans a thin biome configuration extending the gate preset", () => {
    const thin = planned(everything(), ".vibator/biome.json");
    expect(thin.extends).toEqual(["@vibator/gate/biome"]);
  });

  it("plans a thin depcruise configuration extending the gate preset", () => {
    const file = plan(everything()).files.find(
      (entry) => entry.path === ".vibator/depcruise.cjs",
    );
    expect(file?.content).toContain('extends: "@vibator/gate/depcruise"');
  });

  it("plans a tsconfig extending the gate preset when asked", () => {
    const tsconfig = planned(everything(), "tsconfig.json");
    expect(tsconfig.extends).toBe("@vibator/gate/tsconfig");
    const without = plan({ ...everything(), tsconfig: false });
    expect(without.files.some((f) => f.path === "tsconfig.json")).toBe(false);
  });

  it("plans devDependencies for vibator, the gate, and the chosen plugins", () => {
    const dependencies = plan(everything()).devDependencies;
    expect(Object.keys(dependencies).sort()).toEqual([
      "@vibator/biome",
      "@vibator/depcruise",
      "@vibator/gate",
      "@vibator/knip",
      "@vibator/recommended",
      "vibator",
    ]);
  });

  it("plans the version ranges declared in the package's peerDependencies", () => {
    const dependencies = plan(everything()).devDependencies;
    expect(dependencies).toEqual(manifest.peerDependencies);
  });

  it("plans only what was chosen", () => {
    const only: Answers = {
      tools: { biome: false, knip: true, depcruise: false, recommended: false },
      tsconfig: false,
    };
    const result = plan(only);
    expect(result.files.map((f) => f.path)).toEqual([".vibator.json"]);
    const config = planned(only, ".vibator.json");
    expect(config.plugins).toEqual(["@vibator/knip"]);
    expect(config.rules).toEqual({ knip: {} });
    expect(Object.keys(result.devDependencies).sort()).toEqual([
      "@vibator/knip",
      "vibator",
    ]);
  });
});
