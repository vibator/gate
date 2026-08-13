import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "vibator";
import { afterAll, describe, expect, it } from "vitest";

/** The workspace node_modules, linked into each throwaway project. */
const nodeModules = fileURLToPath(
  new URL("../../../../node_modules", import.meta.url),
);

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/**
 * Creates a throwaway project with the given files and the workspace
 * node_modules linked.
 *
 * @param files - The files keyed by root-relative path.
 * @returns The absolute project root.
 */
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "vibator-depcruise-"));
  roots.push(root);
  symlinkSync(nodeModules, join(root, "node_modules"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

/**
 * A `.vibator.json` running only the depcruise rule with the given options.
 *
 * @param options - The rule options.
 * @returns The config file content.
 */
function config(options: Record<string, unknown>): string {
  return JSON.stringify({
    plugins: ["@vibator/depcruise"],
    rules: { depcruise: { options } },
  });
}

/** Two modules importing each other. */
const CYCLE = {
  "cycle-a.ts": `import { pong } from "./cycle-b.ts";

export function ping(count: number): number {
  return count <= 0 ? count : pong(count - 1);
}
`,
  "cycle-b.ts": `import { ping } from "./cycle-a.ts";

export function pong(count: number): number {
  return ping(count - 1);
}
`,
  "package.json": '{"name":"probe","type":"module"}',
};

describe("the depcruise rule", () => {
  it("maps ruleset violations to vibator diagnostics", async () => {
    const root = project({
      ...CYCLE,
      ".vibator.json": config({
        configPath: "@vibator/gate:depcruise.cjs",
      }),
    });
    const { findings, exitCode } = await run({ root, only: ["depcruise"] });

    expect(exitCode).toBe(1);
    expect(findings.every((finding) => finding.ruleId === "depcruise")).toBe(
      true,
    );

    const cycle = findings.find((finding) =>
      finding.message.includes("violates no-circular"),
    );
    expect(cycle).toBeDefined();
    expect(cycle?.file?.includes("cycle-")).toBe(true);
    expect(cycle?.message).toContain("cycle:");
    expect(cycle?.line).toBe(1);
  });

  it("loads a ruleset extending the gate preset natively", async () => {
    const root = project({
      ...CYCLE,
      "depcruise.cjs":
        'module.exports = { extends: "@vibator/gate/depcruise" };\n',
      ".vibator.json": config({ configPath: "./depcruise.cjs" }),
    });
    const { findings, exitCode } = await run({ root, only: ["depcruise"] });

    expect(exitCode).toBe(1);
    expect(
      findings.some((finding) =>
        finding.message.includes("violates no-circular"),
      ),
    ).toBe(true);
  });

  it("reports a project-level finding when configPath names no file", async () => {
    const root = project({
      ...CYCLE,
      ".vibator.json": config({ configPath: "./missing-depcruise.cjs" }),
    });
    const { findings, exitCode } = await run({ root, only: ["depcruise"] });

    expect(exitCode).toBe(1);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toMatch(
      /dependency-cruiser configuration could not be loaded/,
    );
  });
});
