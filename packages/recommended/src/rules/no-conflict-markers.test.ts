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

/** The document with one silenced and one reported merge conflict. */
const CONFLICTED = `# Conflicted

This fixture keeps an unresolved merge on purpose. The demo and the tests
assert the finding. Do not resolve it.

The marker below sits under an ignore marker, so the rule skips it:

vibator-ignore no-conflict-markers: the fixture proves line markers work
=======

The merge below is the one the rule reports:

<<<<<<< HEAD
The demo asserts this line.
=======
The tests assert this line.
>>>>>>> feature-branch
`;

/** The configuration a throwaway project runs with. */
const CONFIG = {
  plugins: ["@vibator/recommended"],
  rules: {
    "no-conflict-markers": {
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

describe("the no-conflict-markers rule over a throwaway project", () => {
  it("reports the first marker no ignore marker silences", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      ".vibator.json": JSON.stringify(CONFIG),
      "src/conflicted.md": CONFLICTED,
    });
    const { findings, exitCode } = await run({
      root,
      only: ["no-conflict-markers"],
    });

    expect(exitCode).toBe(1);
    expect(findings).toHaveLength(1);
    const finding = findings[0];
    expect(finding?.ruleId).toBe("no-conflict-markers");
    expect(finding?.file).toBe("src/conflicted.md");
    expect(finding?.line).toBe(13);
    expect(finding?.message).toContain("<<<<<<< HEAD");
    expect(finding?.expected).toBe("No conflict markers in committed files");
    expect(finding?.fix).toContain("Finish the merge");
  });
});
