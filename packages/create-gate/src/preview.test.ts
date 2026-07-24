import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Plan } from "./plan.ts";
import { paintedPreview, planPreview, wrappedPreview } from "./preview.ts";

/**
 * An empty plan to extend per test.
 *
 * @param overrides - The parts of the plan the test renders.
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

describe("planPreview", () => {
  it("shows a new file's full contents as added lines", () => {
    const root = mkdtempSync(join(tmpdir(), "create-gate-preview-"));
    const preview = planPreview(
      root,
      planWith({
        creations: [
          { path: "biome.json", contents: '{\n  "extends": ["x"]\n}\n' },
        ],
      }),
    );

    expect(preview).toContain("create biome.json:");
    expect(preview).toContain('+   "extends": ["x"]');
  });

  it("shows an extends edit as the exact before and after diff", () => {
    const root = mkdtempSync(join(tmpdir(), "create-gate-preview-"));
    writeFileSync(
      join(root, "biome.json"),
      '{\n  "extends": ["./base.json"],\n  "linter": {}\n}\n',
    );
    const preview = planPreview(
      root,
      planWith({
        changes: [
          {
            kind: "prepend-extends",
            path: "biome.json",
            specifier: "@vibator/gate/biome",
          },
        ],
      }),
    );

    expect(preview).toContain("edit biome.json:");
    expect(preview).toContain('-   "extends": ["./base.json"],');
    expect(preview).toContain('+     "@vibator/gate/biome",');
    // Unchanged surroundings stay as context, not as churn.
    expect(preview).not.toContain("- {");
    expect(preview).toContain('  "linter": {}');
  });

  it("shows only the missing lines for an append", () => {
    const root = mkdtempSync(join(tmpdir(), "create-gate-preview-"));
    writeFileSync(join(root, "hook"), "existing line\n");
    const preview = planPreview(
      root,
      planWith({
        changes: [
          {
            kind: "append-lines",
            path: "hook",
            lines: ["existing line", "new line"],
          },
        ],
      }),
    );

    expect(preview).toContain("append to hook:");
    expect(preview).toContain("+ new line");
    expect(preview).not.toContain("+ existing line");
  });

  it("wraps long lines to the width, repeating the diff marker", () => {
    const long = `+ ${"x".repeat(50)}`;
    const wrapped = wrappedPreview(`header:\n${long}\n- short`, 30);

    const lines = wrapped.split("\n");
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(
      30,
    );
    expect(lines.filter((line) => line.startsWith("+ "))).toHaveLength(2);
    expect(wrapped).toContain("- short");
  });

  it("colours additions green, removals red and context dim", () => {
    const painted = paintedPreview("header:\n+ added\n- removed\n  context");
    expect(painted).toContain("[32m+ added[39m");
    expect(painted).toContain("[31m- removed[39m");
    expect(painted).toContain("[2m  context[22m");
    expect(painted).toContain("header:");
    expect(painted).not.toContain("[32mheader");
  });

  it("warns about script collisions instead of promising an add", () => {
    const root = mkdtempSync(join(tmpdir(), "create-gate-preview-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ scripts: { verify: "make check" } }),
    );
    const preview = planPreview(
      root,
      planWith({
        scripts: { verify: "vibator", format: "biome format --write" },
      }),
    );

    expect(preview).toContain(
      '\u25b2 script "verify" already exists, wanted: vibator',
    );
    expect(preview).toContain('add script "format": biome format --write');
  });

  it("closes with scripts, installs, the skill and the notes", () => {
    const root = mkdtempSync(join(tmpdir(), "create-gate-preview-"));
    const preview = planPreview(
      root,
      planWith({
        scripts: { verify: "biome check && vibator" },
        installs: ["@vibator/gate"],
        followUps: [
          {
            kind: "command",
            reason: "prettier is still here.",
            command: "npx biome migrate prettier --write",
          },
          {
            kind: "replace-script",
            reason: "the gate wants verify.",
            name: "verify",
            command: "vibator",
          },
        ],
        notes: ["something was left alone"],
      }),
    );

    expect(preview).toContain('add script "verify": biome check && vibator');
    expect(preview).toContain("install with npm: @vibator/gate");
    expect(preview).toContain("\u25b2 something was left alone");
    expect(preview).toContain("\u25b2 prettier is still here.");
    expect(preview).toContain(
      "  offered after apply: npx biome migrate prettier --write",
    );
    expect(preview).toContain(
      '  offered after apply: replace script "verify" with: vibator',
    );
  });
});
