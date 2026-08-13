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

/** The module with one bare loop and one silenced one. */
const TOTALS = `/** The demo module the prefer-array-methods rule judges. */
export function total(values: number[]): number {
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  // vibator-ignore prefer-array-methods: the demo proves the loop marker works
  for (const value of values) {
    sum *= value;
  }
  return sum;
}
`;

/** The configuration a throwaway project runs with. */
const CONFIG = {
  plugins: ["@vibator/recommended"],
  rules: {
    "prefer-array-methods": {
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

describe("the prefer-array-methods rule over a throwaway project", () => {
  it("warns on the bare loop and honors the node ignore marker", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      ".vibator.json": JSON.stringify(CONFIG),
      "src/totals.ts": TOTALS,
    });
    const { findings, exitCode } = await run({
      root,
      only: ["prefer-array-methods"],
    });

    expect(exitCode).toBe(0);
    expect(findings).toHaveLength(1);
    const finding = findings[0];
    expect(finding?.severity).toBe("warn");
    expect(finding?.file).toBe("src/totals.ts");
    expect(finding?.line).toBe(4);
    expect(finding?.message).toBe(
      "Loop body is a single statement with no break, continue, return or await",
    );
    expect(finding?.expected).toBe("An array method that names the operation");
  });
});
