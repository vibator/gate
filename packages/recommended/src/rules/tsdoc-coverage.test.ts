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

/** The module with documented, undocumented, and silenced functions. */
const SERVICE = `/** The demo module the tsdoc-coverage rule judges. */

/**
 * Doubles a value.
 *
 * @param value - The value to double.
 * @returns Twice the value.
 */
export function double(value: number): number {
  return value * 2;
}

export function triple(value: number): number {
  return value * 3;
}

/**
 * Scales a value.
 *
 * @returns The scaled value.
 */
export function scale(value: number, factor: number): number {
  return value * factor;
}

// vibator-ignore tsdoc-coverage: the demo proves the line marker works
export function quadruple(value: number): number {
  return value * 4;
}
`;

/** The configuration a throwaway project runs with. */
const CONFIG = {
  plugins: ["@vibator/recommended"],
  rules: {
    "tsdoc-coverage": {
      options: {
        include: ["src/**"],
      },
    },
  },
};

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
  const root = mkdtempSync(join(tmpdir(), "vibator-recommended-"));
  roots.push(root);
  symlinkSync(nodeModules, join(root, "node_modules"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe("the tsdoc-coverage rule over a throwaway project", () => {
  it("reports missing docs and tags, honoring the line marker", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      ".vibator.json": JSON.stringify(CONFIG),
      "src/service.ts": SERVICE,
    });
    const { findings, exitCode } = await run({
      root,
      only: ["tsdoc-coverage"],
    });

    expect(exitCode).toBe(1);
    expect(findings).toHaveLength(3);
    expect(findings.every((finding) => finding.file === "src/service.ts")).toBe(
      true,
    );

    const undocumented = findings.find((finding) => finding.line === 13);
    expect(undocumented?.message).toBe("triple: needs a TSDoc block");
    expect(undocumented?.expected).toBe(
      "A TSDoc block stating the contract, with @param and @returns where due",
    );

    const parameters = findings.filter((finding) => finding.line === 22);
    expect(parameters.map((finding) => finding.message).sort()).toEqual([
      'scale: missing @param for "factor"',
      'scale: missing @param for "value"',
    ]);
  });
});
