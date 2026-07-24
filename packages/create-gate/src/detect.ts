/**
 * Reads the target repository into the snapshot the wizard decides from.
 * Detection only looks; it never writes.
 *
 * @packageDocumentation
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  FoundConfigs,
  FoundHookManagers,
  PackageManager,
  Snapshot,
} from "./plan.ts";

/** The package.json fields the wizard inspects. */
interface Manifest {
  /** Declared npm scripts. */
  scripts?: Record<string, string>;
  /** Workspace globs, when the repository is a monorepo. */
  workspaces?: unknown;
  /** The package manager pin, such as `pnpm@9`. */
  packageManager?: string;
  /** Production dependencies. */
  dependencies?: Record<string, string>;
  /** Development dependencies. */
  devDependencies?: Record<string, string>;
  /** simple-git-hooks configuration, when the repository uses it. */
  "simple-git-hooks"?: unknown;
}

/** Filenames each tool accepts for its configuration. */
const CONFIG_CANDIDATES: Record<keyof FoundConfigs, string[]> = {
  biome: ["biome.json", "biome.jsonc"],
  eslint: [
    ".eslintrc",
    ".eslintrc.json",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.yml",
    ".eslintrc.yaml",
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    "eslint.config.ts",
  ],
  prettier: [
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.yml",
    ".prettierrc.yaml",
    ".prettierrc.js",
    ".prettierrc.cjs",
    "prettier.config.js",
    "prettier.config.cjs",
    "prettier.config.mjs",
  ],
  knip: [
    "knip.json",
    "knip.jsonc",
    "knip.ts",
    "knip.js",
    "knip.config.ts",
    "knip.config.js",
  ],
  depcruise: [
    ".dependency-cruiser.cjs",
    ".dependency-cruiser.js",
    ".dependency-cruiser.mjs",
    ".dependency-cruiser.json",
  ],
  vibator: ["vibator.json", ".vibator.json"],
  tsconfig: ["tsconfig.json"],
  commitlint: [
    "commitlint.config.mjs",
    "commitlint.config.js",
    "commitlint.config.cjs",
    "commitlint.config.ts",
    ".commitlintrc",
    ".commitlintrc.json",
    ".commitlintrc.yml",
    ".commitlintrc.yaml",
    ".commitlintrc.js",
    ".commitlintrc.cjs",
  ],
};

/**
 * Reads and parses package.json, tolerating its absence.
 *
 * @param root - Absolute repository root.
 * @returns The manifest, or `undefined` when missing or unreadable.
 */
function readManifest(root: string): Manifest | undefined {
  try {
    return JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as Manifest;
  } catch {
    return undefined;
  }
}

/**
 * The first of the candidate files that exists.
 *
 * @param root - Absolute repository root.
 * @param candidates - Filenames to try, in order.
 * @returns The matching filename, or `undefined`.
 */
function firstExisting(root: string, candidates: string[]): string | undefined {
  return candidates.find((candidate) => existsSync(join(root, candidate)));
}

/**
 * The package manager the repository uses.
 *
 * @param root - Absolute repository root.
 * @param manifest - The parsed package.json, when there is one.
 * @returns The manager, from the `packageManager` pin, then lockfiles, then npm.
 */
function detectPackageManager(
  root: string,
  manifest: Manifest | undefined,
): PackageManager {
  const pinned = manifest?.packageManager?.split("@")[0];
  if (
    pinned === "pnpm" ||
    pinned === "yarn" ||
    pinned === "bun" ||
    pinned === "npm"
  ) {
    return pinned;
  }
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "bun.lock")) || existsSync(join(root, "bun.lockb")))
    return "bun";
  return "npm";
}

/**
 * Locates every relevant configuration file.
 *
 * @param root - Absolute repository root.
 * @returns One path per tool that has a config.
 */
function detectConfigs(root: string): FoundConfigs {
  const found: FoundConfigs = {};
  for (const [tool, candidates] of Object.entries(CONFIG_CANDIDATES)) {
    const path = firstExisting(root, candidates);
    if (path) found[tool as keyof FoundConfigs] = path;
  }
  return found;
}

/**
 * Detects which git hook managers are already in place.
 *
 * @param root - Absolute repository root.
 * @param installed - Names of installed packages.
 * @param manifest - The parsed package.json.
 * @returns One flag per manager.
 */
function detectHookManagers(
  root: string,
  installed: string[],
  manifest: Manifest | undefined,
): FoundHookManagers {
  const lefthookConfig = firstExisting(root, [
    "lefthook.yml",
    "lefthook.yaml",
    "lefthook.toml",
    "lefthook.json",
  ]);
  return {
    husky: existsSync(join(root, ".husky")),
    lefthook: Boolean(lefthookConfig) || installed.includes("lefthook"),
    simpleGitHooks:
      manifest?.["simple-git-hooks"] !== undefined ||
      installed.includes("simple-git-hooks"),
  };
}

/**
 * Whether tsconfig.json can safely gain an `extends` entry: it parses as
 * plain JSON and does not extend anything yet.
 *
 * @param root - Absolute repository root.
 * @param tsconfig - The tsconfig filename, when one exists.
 * @returns Whether the wizard may edit it.
 */
function tsconfigExtendable(root: string, tsconfig?: string): boolean {
  if (!tsconfig) return false;
  try {
    const parsed = JSON.parse(
      readFileSync(join(root, tsconfig), "utf8"),
    ) as Record<string, unknown>;
    return parsed.extends === undefined;
  } catch {
    return false;
  }
}

/**
 * Reads the target repository into a snapshot.
 *
 * @param root - Absolute repository root.
 * @returns Everything the wizard needs to decide.
 */
export function takeSnapshot(root: string): Snapshot {
  const manifest = readManifest(root);
  const installed = Object.keys({
    ...manifest?.dependencies,
    ...manifest?.devDependencies,
  });
  const configs = detectConfigs(root);
  return {
    root,
    hasPackageJson: manifest !== undefined,
    isGitRepository: existsSync(join(root, ".git")),
    packageManager: detectPackageManager(root, manifest),
    usesTypeScript:
      configs.tsconfig !== undefined || installed.includes("typescript"),
    tsconfigExtendable: tsconfigExtendable(root, configs.tsconfig),
    hasWorkspaces: manifest?.workspaces !== undefined,
    hasSourceDirectory: existsSync(join(root, "src")),
    scripts: manifest?.scripts ?? {},
    installedPackages: installed,
    configs,
    hooks: detectHookManagers(root, installed, manifest),
    hasQualityWorkflow: existsSync(
      join(root, ".github", "workflows", "quality.yml"),
    ),
    agentsFile: firstExisting(root, ["AGENTS.md", "CLAUDE.md"]),
  };
}
