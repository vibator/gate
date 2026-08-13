import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "vibator";
import { describe, expect, it } from "vitest";
import "../index.ts";

/** The workspace node_modules, linked into each throwaway repository. */
const nodeModules = fileURLToPath(
  new URL("../../../../node_modules", import.meta.url),
);

/** A generator script that writes a fixed output file. */
const GENERATOR_SCRIPT =
  "require('fs').writeFileSync('gen.txt', 'generated\\n');\n";

/** The configuration a throwaway repository runs with. */
const CONFIG = {
  rules: {
    "codegen-drift": {
      severity: "error",
      options: {
        generators: [
          { name: "fixture", command: "node gen.js", paths: ["gen.txt"] },
        ],
      },
    },
  },
};

/**
 * Builds a throwaway git repository with a generator and its committed
 * output.
 *
 * @param committedOutput - The content committed as gen.txt.
 * @returns The repository root.
 */
function repositoryWith(committedOutput: string): string {
  const root = mkdtempSync(join(tmpdir(), "vibator-recommended-"));
  const git = (command: string) =>
    execSync(`git ${command}`, { cwd: root, stdio: "pipe" });
  writeFileSync(join(root, "gen.js"), GENERATOR_SCRIPT);
  writeFileSync(join(root, "gen.txt"), committedOutput);
  writeFileSync(join(root, ".vibator.json"), JSON.stringify(CONFIG));
  writeFileSync(join(root, ".gitignore"), "node_modules\n");
  symlinkSync(nodeModules, join(root, "node_modules"));
  git("init -q -b main");
  git("config user.email test@example.com");
  git("config user.name test");
  git("add .");
  git("commit -qm initial");
  return root;
}

describe("the codegen-drift rule over a throwaway repository", () => {
  it("passes when the committed output matches the generator", async () => {
    const root = repositoryWith("generated\n");
    const { findings, exitCode } = await run({ root, only: ["codegen-drift"] });

    expect(findings).toEqual([]);
    expect(exitCode).toBe(0);
  });

  it("flags drifted output and restores the committed content", async () => {
    const root = repositoryWith("stale\n");
    const { findings, exitCode } = await run({ root, only: ["codegen-drift"] });

    expect(exitCode).toBe(1);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.file?.endsWith("gen.txt")).toBe(true);
    expect(findings[0]?.message).toBe(
      'Out of date: regenerating "fixture" changes this file',
    );
    expect(findings[0]?.fix).toContain("node gen.js");
    expect(readFileSync(join(root, "gen.txt"), "utf8")).toBe("stale\n");
  });

  it("refuses to check paths with uncommitted changes", async () => {
    const root = repositoryWith("generated\n");
    writeFileSync(join(root, "gen.txt"), "edited\n");
    const { findings } = await run({ root, only: ["codegen-drift"] });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('Refusing to check "fixture"');
  });
});
