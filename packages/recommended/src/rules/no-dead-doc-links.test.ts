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
import "./no-dead-doc-links.ts";

/** The workspace node_modules, linked into each throwaway project. */
const nodeModules = fileURLToPath(
  new URL("../../../../node_modules", import.meta.url),
);

/** The guide with one live, one external, one silenced, and one dead link. */
const GUIDE = `# Guide

The [diagram](./assets/diagram.txt) exists, and the
[vibator repository](https://github.com/vibator/vibator) is external.

A code span shows \`[example](./missing-example.md)\` and is skipped.

<!-- vibator-ignore no-dead-doc-links: the demo proves the line marker works -->
The [silenced link](./silenced.md) sits under an ignore marker.

The [moved chapter](./chapters/setup.md) is the dead link the rule reports.
`;

/** The target of the guide's live link. */
const DIAGRAM = `The guide links this file to prove a resolving link is not reported.
`;

/** The configuration a throwaway project runs with. */
const CONFIG = {
  rules: {
    "no-dead-doc-links": {
      options: {
        include: ["docs/**/*.md"],
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

describe("the no-dead-doc-links rule over a throwaway project", () => {
  it("reports the dead link and skips external, code, and silenced ones", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      ".vibator.json": JSON.stringify(CONFIG),
      "docs/guide.md": GUIDE,
      "docs/assets/diagram.txt": DIAGRAM,
    });
    const { findings, exitCode } = await run({
      root,
      only: ["no-dead-doc-links"],
    });

    expect(exitCode).toBe(1);
    expect(findings).toHaveLength(1);
    const finding = findings[0];
    expect(finding?.ruleId).toBe("no-dead-doc-links");
    expect(finding?.file).toBe("docs/guide.md");
    expect(finding?.line).toBe(11);
    expect(finding?.message).toBe(
      "Link target does not exist: ./chapters/setup.md",
    );
    expect(finding?.expected).toBe(
      "Every relative link resolves to a file in the repository",
    );
    expect(finding?.fix).toContain("./chapters/setup.md");
  });
});
