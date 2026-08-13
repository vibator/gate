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

/** The module with two filler names and one silenced one. */
const PARSER = `/** The demo module the meaningful-names rule judges. */
export function parseQuote(data: string): number {
  const tmp = Number(data);
  // vibator-ignore meaningful-names: published cyrb53 state name
  const h1 = tmp * 2;
  return h1;
}
`;

/** The configuration a throwaway project runs with. */
const CONFIG = {
  plugins: ["@vibator/recommended"],
  rules: {
    "meaningful-names": {
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

describe("the meaningful-names rule over a throwaway project", () => {
  it("reports filler names and honors the node ignore marker", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      ".vibator.json": JSON.stringify(CONFIG),
      "src/parser.ts": PARSER,
    });
    const { findings, exitCode } = await run({
      root,
      only: ["meaningful-names"],
    });

    expect(exitCode).toBe(1);
    expect(findings).toHaveLength(2);
    expect(findings.every((finding) => finding.file === "src/parser.ts")).toBe(
      true,
    );

    const parameter = findings.find((finding) => finding.line === 2);
    expect(parameter?.message).toBe(
      '"data" is a filler name that says nothing about the value',
    );
    expect(parameter?.expected).toBe("A name that says what the value is");

    const variable = findings.find((finding) => finding.line === 3);
    expect(variable?.message).toBe(
      '"tmp" is a filler name that says nothing about the value',
    );
  });
});
