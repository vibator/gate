import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Absolute path of the CLI entry point under test. */
const CLI = fileURLToPath(new URL("./cli.ts", import.meta.url));

/**
 * Runs the CLI in a directory. Spawned processes have no TTY, which is
 * exactly the agent situation the flags exist for.
 *
 * @param cliArguments - Arguments after the script name.
 * @param cwd - Where to run.
 * @returns Captured stdout, stderr and the exit code.
 */
function runCli(
  cliArguments: string[],
  cwd: string,
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync(
      process.execPath,
      ["--no-warnings", "--experimental-strip-types", CLI, ...cliArguments],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { stdout, stderr: "", exitCode: 0 };
  } catch (failure) {
    const failed = failure as {
      stdout?: string;
      stderr?: string;
      status?: number;
    };
    return {
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? "",
      exitCode: failed.status ?? 1,
    };
  }
}

/**
 * A fresh fixture repository with a package.json and a fake .git.
 *
 * @param files - Additional files to seed.
 * @returns The absolute root.
 */
function fixture(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "create-gate-e2e-"));
  writeFileSync(join(root, "package.json"), '{\n  "name": "fixture"\n}\n');
  mkdirSync(join(root, ".git"));
  for (const [path, contents] of Object.entries(files)) {
    writeFileSync(join(root, path), contents);
  }
  return root;
}

describe("create-gate cli", () => {
  it("prints usage with the full flag surface on --help", () => {
    const { stdout, exitCode } = runCli(["--help"], fixture());
    expect(stdout).toContain("npm create @vibator/gate");
    expect(stdout).toContain("--defaults");
    expect(stdout).toContain("--dry-run");
    expect(exitCode).toBe(0);
  });

  it("never hangs without a terminal: exits 2 naming the way out", () => {
    const { stderr, exitCode } = runCli([], fixture());
    expect(exitCode).toBe(2);
    expect(stderr).toContain("--defaults");
  });

  it("prints a JSON plan on --dry-run and changes nothing", () => {
    const root = fixture();
    const { stdout, exitCode } = runCli(["--defaults", "--dry-run"], root);

    expect(exitCode).toBe(0);
    const printed = JSON.parse(stdout) as {
      plan: { creations: { path: string }[] };
      reproduce: string;
    };
    expect(printed.plan.creations.map((c) => c.path)).toContain("vibator.json");
    expect(printed.reproduce).toContain("--lint=create");
    expect(existsSync(join(root, "vibator.json"))).toBe(false);
  });

  it("sets a fresh repository up end to end with --defaults", () => {
    const root = fixture();
    const { stdout, exitCode } = runCli(["--defaults", "--skip-install"], root);

    expect(exitCode).toBe(0);
    for (const path of [
      "biome.json",
      "vibator.json",
      ".dependency-cruiser.cjs",
      ".commitlintrc.json",
      ".husky/pre-commit",
      ".github/workflows/quality.yml",
      "AGENTS.md",
    ]) {
      expect(existsSync(join(root, path)), path).toBe(true);
    }
    const manifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(manifest.scripts.verify).toContain("vibator");
    expect(stdout).toContain("Reproduce these choices:");
  });

  it("re-runs idempotently: asks again, rewrites nothing", () => {
    const root = fixture();
    runCli(["--defaults", "--skip-install"], root);
    const before = readFileSync(join(root, "vibator.json"), "utf8");
    const hookBefore = readFileSync(join(root, ".husky/pre-commit"), "utf8");

    const { stdout, exitCode } = runCli(["--defaults", "--skip-install"], root);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("vibator.json already extends @vibator/gate");
    expect(stdout).toContain("already has the gate's lines");
    expect(readFileSync(join(root, "vibator.json"), "utf8")).toBe(before);
    expect(readFileSync(join(root, ".husky/pre-commit"), "utf8")).toBe(
      hookBefore,
    );
  });

  it("extends an existing biome config instead of replacing it", () => {
    const root = fixture({ "biome.json": '{ "linter": { "enabled": true } }' });
    runCli(["--defaults", "--skip-install"], root);

    const updated = JSON.parse(
      readFileSync(join(root, "biome.json"), "utf8"),
    ) as { extends: string[]; linter: object };
    expect(updated.extends).toEqual(["@vibator/gate/biome"]);
    expect(updated.linter).toEqual({ enabled: true });
  });

  it("refuses to run where there is no package.json", () => {
    const root = mkdtempSync(join(tmpdir(), "create-gate-e2e-"));
    const { stderr, exitCode } = runCli(["--defaults"], root);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("package.json");
  });
});
