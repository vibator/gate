import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyPlan, runFollowUps } from "./apply.ts";
import type { Plan } from "./plan.ts";

/**
 * An empty plan to extend per test.
 *
 * @param overrides - The parts of the plan the test exercises.
 * @returns The plan.
 */
function planWith(overrides: Partial<Plan>): Plan {
  return {
    packageManager: "npm",
    installs: [],
    creations: [],
    changes: [],
    scripts: {},
    followUps: [],
    notes: [],
    ...overrides,
  };
}

/**
 * A throwaway repository with a package.json.
 *
 * @param files - Additional files to seed.
 * @returns The absolute root.
 */
function repositoryWith(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "create-gate-"));
  writeFileSync(join(root, "package.json"), '{\n  "name": "fixture"\n}\n');
  for (const [path, contents] of Object.entries(files)) {
    writeFileSync(join(root, path), contents);
  }
  return root;
}

describe("applyPlan", () => {
  it("creates planned files but never overwrites an existing one", () => {
    const root = repositoryWith({ "biome.json": '{ "mine": true }' });
    const plan = planWith({
      creations: [
        { path: "biome.json", contents: "{}" },
        { path: "vibator.json", contents: '{ "extends": [] }' },
      ],
    });

    const report = applyPlan(root, plan, true);
    expect(readFileSync(join(root, "biome.json"), "utf8")).toContain("mine");
    expect(readFileSync(join(root, "vibator.json"), "utf8")).toContain(
      "extends",
    );
    expect(report.unchanged.join(" ")).toContain("biome.json already exists");
    expect(report.notes).toEqual([]);
  });

  it("prepends the gate to an existing extends chain", () => {
    const root = repositoryWith({
      "biome.json": '{ "extends": ["./base.json"], "linter": {} }',
    });
    const plan = planWith({
      changes: [
        {
          kind: "prepend-extends",
          path: "biome.json",
          specifier: "@vibator/gate/biome",
        },
      ],
    });

    applyPlan(root, plan, true);
    const updated = JSON.parse(readFileSync(join(root, "biome.json"), "utf8"));
    expect(updated.extends).toEqual(["@vibator/gate/biome", "./base.json"]);
    expect(updated.linter).toEqual({});
  });

  it("writes tsconfig extends as a bare string when there was none", () => {
    const root = repositoryWith({
      "tsconfig.json": '{ "compilerOptions": { "strict": false } }',
    });
    const plan = planWith({
      changes: [
        {
          kind: "tsconfig-extends",
          path: "tsconfig.json",
          specifier: "@vibator/gate/tsconfig",
        },
      ],
    });

    applyPlan(root, plan, true);
    const updated = JSON.parse(
      readFileSync(join(root, "tsconfig.json"), "utf8"),
    );
    expect(updated.extends).toBe("@vibator/gate/tsconfig");
  });

  it("turns a non-JSON config into a note instead of an edit", () => {
    const root = repositoryWith({ "biome.json": "{ // comment\n }" });
    const plan = planWith({
      changes: [
        {
          kind: "prepend-extends",
          path: "biome.json",
          specifier: "@vibator/gate/biome",
        },
      ],
    });

    const report = applyPlan(root, plan, true);
    expect(readFileSync(join(root, "biome.json"), "utf8")).toContain(
      "// comment",
    );
    expect(report.notes.join(" ")).toContain("not plain JSON");
  });

  it("appends only the hook lines a file is missing, idempotently", () => {
    const root = repositoryWith();
    mkdirSync(join(root, ".husky"));
    writeFileSync(
      join(root, ".husky/pre-commit"),
      "npx biome check --staged\n",
    );
    const plan = planWith({
      changes: [
        {
          kind: "append-lines",
          path: ".husky/pre-commit",
          lines: ["npx biome check --staged", "npx vibator --staged"],
        },
      ],
    });

    applyPlan(root, plan, true);
    const once = readFileSync(join(root, ".husky/pre-commit"), "utf8");
    applyPlan(root, plan, true);
    const twice = readFileSync(join(root, ".husky/pre-commit"), "utf8");

    expect(once).toBe("npx biome check --staged\nnpx vibator --staged\n");
    expect(twice).toBe(once);
  });

  it("skips a guarded append when the section heading already exists", () => {
    const root = repositoryWith({
      "AGENTS.md": "# Agents\n\n## Vibator\n\nOld wording here.\n",
    });
    const plan = planWith({
      changes: [
        {
          kind: "append-lines",
          path: "AGENTS.md",
          lines: ["## Vibator", "New wording that must not interleave."],
          guard: "## Vibator",
        },
      ],
    });

    const report = applyPlan(root, plan, true);
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).not.toContain(
      "New wording",
    );
    expect(report.unchanged.join(" ")).toContain('"## Vibator" section');
  });

  it("runs consented follow-ups and reports a failure as a note", () => {
    const root = repositoryWith();
    const report = runFollowUps(root, [
      {
        kind: "command",
        reason: "works.",
        command: 'node -e "process.exit(0)"',
      },
      {
        kind: "command",
        reason: "breaks.",
        command: 'node -e "process.exit(3)"',
      },
      {
        kind: "replace-script",
        reason: "gate.",
        name: "verify",
        command: "vibator",
      },
    ]);

    expect(report.performed.join(" ")).toContain('node -e "process.exit(0)"');
    expect(report.notes.join(" ")).toContain(
      'follow-up failed; run it yourself: node -e "process.exit(3)"',
    );
    const manifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(manifest.scripts.verify).toBe("vibator");
  });

  it("adds scripts without replacing existing ones", () => {
    const root = mkdtempSync(join(tmpdir(), "create-gate-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ scripts: { verify: "make check" } }),
    );
    const plan = planWith({
      scripts: {
        verify: "biome check && vibator",
        format: "biome format --write",
      },
    });

    const report = applyPlan(root, plan, true);
    const manifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    );
    expect(manifest.scripts.verify).toBe("make check");
    expect(manifest.scripts.format).toBe("biome format --write");
    expect(report.notes).toEqual([]);
  });

  it("reports skipped installs with the exact command to run", () => {
    const root = repositoryWith();
    const plan = planWith({ installs: ["@vibator/gate", "knip"] });

    const report = applyPlan(root, plan, true);
    expect(report.notes.join(" ")).toContain(
      "npm install --save-dev @vibator/gate knip",
    );
  });
});
