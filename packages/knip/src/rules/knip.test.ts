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
  const root = mkdtempSync(join(tmpdir(), "vibator-knip-"));
  roots.push(root);
  symlinkSync(nodeModules, join(root, "node_modules"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

/** A project with an unused export and an unused file. */
const PROJECT_FILES = {
  "package.json": '{"name":"probe","type":"module","main":"index.ts"}',
  "knip.json": '{"entry":["index.ts"],"project":["*.ts"]}',
  "index.ts": `import { shout } from "./util.ts";

export function main(): string {
  return shout("hello");
}
`,
  "util.ts": `export function shout(text: string): string {
  return \`\${text.toUpperCase()}!\`;
}

export function whisper(text: string): string {
  return text.toLowerCase();
}
`,
  "orphan.ts": `export function forgotten(): number {
  return 1;
}
`,
};

describe("the knip rule", () => {
  it("maps Knip's issues to vibator diagnostics", async () => {
    const root = project({
      ...PROJECT_FILES,
      ".vibator.json": '{"plugins":["@vibator/knip"],"rules":{"knip":{}}}',
    });
    const { findings, exitCode } = await run({ root, only: ["knip"] });

    expect(exitCode).toBe(1);
    expect(findings.every((finding) => finding.ruleId === "knip")).toBe(true);

    const unusedExport = findings.find((finding) =>
      finding.message.includes("The export whisper is unused"),
    );
    expect(unusedExport).toBeDefined();
    expect(unusedExport?.file).toBe("util.ts");
    expect(unusedExport?.line).toBe(5);
    expect(unusedExport?.message).toContain("(knip/exports)");

    const unusedFile = findings.find(
      (finding) =>
        finding.message.includes("This file is unused") &&
        finding.file === "orphan.ts",
    );
    expect(unusedFile).toBeDefined();
  });

  it("reports a project-level finding when configPath names no file", async () => {
    const root = project({
      ...PROJECT_FILES,
      ".vibator.json":
        '{"plugins":["@vibator/knip"],"rules":{"knip":{"options":{"configPath":"./missing-knip.json"}}}}',
    });
    const { findings, exitCode } = await run({ root, only: ["knip"] });

    expect(exitCode).toBe(1);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toMatch(
      /Knip configuration could not be loaded/,
    );
  });
});
