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
 * Runs the CLI in a directory, terminal-less.
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
 * A fixture repository with a manifest, a fake .git and extra files.
 *
 * @param manifest - The package.json contents.
 * @param files - Additional files to seed.
 * @returns The absolute root.
 */
function fixture(
  manifest: object = { name: "fixture" },
  files: Record<string, string> = {},
): string {
  const root = mkdtempSync(join(tmpdir(), "create-gate-scenario-"));
  writeFileSync(join(root, "package.json"), JSON.stringify(manifest, null, 2));
  mkdirSync(join(root, ".git"));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

describe("wizard scenarios", () => {
  it("drives pnpm repositories with pnpm, down to the CI workflow", () => {
    const root = fixture({ name: "fixture" }, { "pnpm-lock.yaml": "" });
    const { stdout } = runCli(["--defaults", "--dry-run"], root);

    const printed = JSON.parse(stdout) as {
      plan: {
        packageManager: string;
        creations: { path: string; contents: string }[];
      };
    };
    expect(printed.plan.packageManager).toBe("pnpm");
    const workflow = printed.plan.creations.find(
      (creation) => creation.path === ".github/workflows/quality.yml",
    );
    expect(workflow?.contents).toContain("pnpm install --frozen-lockfile");
    expect(workflow?.contents).toContain("pnpm run verify");
  });

  it("disables the type-aware rule in a JavaScript-only repository", () => {
    const root = fixture();
    const { exitCode } = runCli(["--defaults", "--skip-install"], root);

    expect(exitCode).toBe(0);
    const vibator = readFileSync(join(root, "vibator.json"), "utf8");
    expect(vibator).toContain('"no-deprecated-apis": "off"');
    expect(existsSync(join(root, "tsconfig.json"))).toBe(false);
  });

  it("respects an ESLint setup: no biome config, no lobbying note", () => {
    const root = fixture({ name: "fixture" }, { ".eslintrc.json": "{}" });
    const { stdout, exitCode } = runCli(["--defaults", "--skip-install"], root);

    expect(exitCode).toBe(0);
    expect(existsSync(join(root, "biome.json"))).toBe(false);
    const manifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(manifest.scripts.verify).not.toContain("biome");
    expect(stdout).not.toContain("biome migrate");
    expect(stdout).toContain("--lint=skip");
  });

  it("appends to an existing husky hook without touching its lines", () => {
    const root = fixture();
    mkdirSync(join(root, ".husky"));
    writeFileSync(join(root, ".husky", "pre-commit"), "npm run my-check\n");

    runCli(["--defaults", "--skip-install"], root);
    const hook = readFileSync(join(root, ".husky", "pre-commit"), "utf8");
    expect(hook.startsWith("npm run my-check\n")).toBe(true);
    expect(hook).toContain("vibator --staged");
  });

  it("hands hook lines to lefthook users instead of installing husky", () => {
    const root = fixture({ name: "fixture" }, { "lefthook.yml": "" });
    const { stdout } = runCli(["--defaults", "--skip-install"], root);

    expect(existsSync(join(root, ".husky"))).toBe(false);
    expect(stdout).toContain("other than husky");
  });

  it("keeps an existing verify script and reports the collision", () => {
    const root = fixture({
      name: "fixture",
      scripts: { verify: "make check" },
    });
    const { stdout } = runCli(["--defaults", "--skip-install"], root);

    const manifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(manifest.scripts.verify).toBe("make check");
    expect(stdout).toContain('replace script "verify"');
  });

  it("leaves a commented tsconfig alone and says what to add", () => {
    const root = fixture(
      { name: "fixture" },
      { "tsconfig.json": '{ // strict\n  "compilerOptions": {} }' },
    );
    const { stdout } = runCli(
      ["--defaults", "--skip-install", "--tsconfig=yes"],
      root,
    );

    expect(readFileSync(join(root, "tsconfig.json"), "utf8")).toContain(
      "// strict",
    );
    expect(stdout).toContain('"extends": "@vibator/gate/tsconfig"');
  });

  it("still gates a workspaces monorepo with the generic presets", () => {
    const root = fixture({ name: "fixture", workspaces: ["packages/*"] });
    const { exitCode } = runCli(["--defaults", "--skip-install"], root);

    expect(exitCode).toBe(0);
    expect(existsSync(join(root, "vibator.json"))).toBe(true);
    expect(existsSync(join(root, "biome.json"))).toBe(true);
  });
});
