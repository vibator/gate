import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { takeSnapshot } from "./detect.ts";

/**
 * Builds a throwaway repository directory.
 *
 * @param files - Repo-relative path to contents.
 * @returns The absolute root.
 */
function repositoryWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "create-gate-"));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

describe("takeSnapshot", () => {
  it("reads manager, scripts and TypeScript from package.json land", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: { test: "vitest" },
        devDependencies: { typescript: "^5" },
      }),
      "pnpm-lock.yaml": "",
    });

    const snapshot = takeSnapshot(root);
    expect(snapshot.hasPackageJson).toBe(true);
    expect(snapshot.packageManager).toBe("pnpm");
    expect(snapshot.usesTypeScript).toBe(true);
    expect(snapshot.scripts.test).toBe("vitest");
    expect(snapshot.installedPackages).toContain("typescript");
  });

  it("prefers the packageManager pin over lockfiles", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ packageManager: "bun@1.2.0" }),
      "yarn.lock": "",
    });
    expect(takeSnapshot(root).packageManager).toBe("bun");
  });

  it("finds existing configurations and hook managers", () => {
    const root = repositoryWith({
      "package.json": "{}",
      "biome.json": "{}",
      ".eslintrc.json": "{}",
      "lefthook.yml": "",
      ".github/workflows/quality.yml": "name: Quality",
    });
    mkdirSync(join(root, ".husky"), { recursive: true });

    const snapshot = takeSnapshot(root);
    expect(snapshot.configs.biome).toBe("biome.json");
    expect(snapshot.configs.eslint).toBe(".eslintrc.json");
    expect(snapshot.hooks.husky).toBe(true);
    expect(snapshot.hooks.lefthook).toBe(true);
    expect(snapshot.hasQualityWorkflow).toBe(true);
  });

  it("judges tsconfig extendable only when plain JSON without extends", () => {
    const extendable = repositoryWith({
      "package.json": "{}",
      "tsconfig.json": '{ "compilerOptions": {} }',
    });
    const withComments = repositoryWith({
      "package.json": "{}",
      "tsconfig.json": '{ // strict\n "compilerOptions": {} }',
    });
    const alreadyExtends = repositoryWith({
      "package.json": "{}",
      "tsconfig.json": '{ "extends": "@acme/tsconfig" }',
    });

    expect(takeSnapshot(extendable).tsconfigExtendable).toBe(true);
    expect(takeSnapshot(withComments).tsconfigExtendable).toBe(false);
    expect(takeSnapshot(alreadyExtends).tsconfigExtendable).toBe(false);
  });

  it("prefers AGENTS.md over CLAUDE.md as the agent file", () => {
    const both = repositoryWith({
      "package.json": "{}",
      "AGENTS.md": "# a",
      "CLAUDE.md": "# c",
    });
    const claudeOnly = repositoryWith({
      "package.json": "{}",
      "CLAUDE.md": "# c",
    });
    const neither = repositoryWith({ "package.json": "{}" });

    expect(takeSnapshot(both).agentsFile).toBe("AGENTS.md");
    expect(takeSnapshot(claudeOnly).agentsFile).toBe("CLAUDE.md");
    expect(takeSnapshot(neither).agentsFile).toBeUndefined();
  });

  it("copes with a directory that has no package.json", () => {
    const root = mkdtempSync(join(tmpdir(), "create-gate-"));
    const snapshot = takeSnapshot(root);
    expect(snapshot.hasPackageJson).toBe(false);
    expect(snapshot.packageManager).toBe("npm");
  });
});
