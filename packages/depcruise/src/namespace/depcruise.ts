/**
 * The `depcruise` subnamespace: a gateway to dependency-cruiser driven
 * through its JavaScript API, never through a shell command.
 *
 * Importing this module registers the namespace onto the shared `vibator`
 * object, so rules reach it as `vibator.depcruise`.
 *
 * @packageDocumentation
 */
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { ICruiseOptions, ICruiseResult } from "dependency-cruiser";
import { cruise } from "dependency-cruiser";
import extractDepcruiseOptions from "dependency-cruiser/config-utl/extract-depcruise-options";
import { vibator } from "vibator";

/** The options every depcruise namespace call accepts. */
export interface DepcruiseOptions {
  /**
   * Complete cruise options passed programmatically (a ruleset under
   * `ruleSet`). Takes precedence over `configPath` and the root
   * configuration files.
   */
  config?: ICruiseOptions;
  /**
   * Reference to a dependency-cruiser configuration file: a `./` path from
   * the project root, an absolute path, a `package:path` reference such as
   * `@vibator/gate:depcruise.cjs`, or a package export such as
   * `@vibator/gate/depcruise`. When omitted, `.dependency-cruiser.js`,
   * `.cjs`, `.mjs`, then `.json` at the project root are used.
   */
  configPath?: string;
}

/** One dependency-cruiser violation with resolved paths. */
export interface DepcruiseViolation {
  /** The name of the violated rule. */
  rule: string;
  /** The severity the ruleset assigns the rule. */
  severity: "error" | "warn" | "info" | "ignore";
  /** The absolute path of the module the dependency starts from. */
  from: string;
  /** The absolute path of the module the dependency points at. */
  to: string;
  /** The module names along the cycle, when the violation is circular. */
  cycle?: string[];
  /** The explanation the ruleset carries for the rule, when one is set. */
  comment?: string;
}

/** The configuration file names probed at the project root, in order. */
const DEFAULT_CONFIG_NAMES = [
  ".dependency-cruiser.js",
  ".dependency-cruiser.cjs",
  ".dependency-cruiser.mjs",
  ".dependency-cruiser.json",
];

/** The resolved cruise options per configuration, reused across calls. */
const optionsCache = new Map<string, Promise<ICruiseOptions>>();

/**
 * Resolves a configured path to the absolute configuration file, through
 * `vibator.module.resolve` from the project root.
 *
 * @param configPath - The configured path.
 * @returns The absolute path.
 * @throws When the path resolves to no file or names an uninstalled package.
 */
function configuredFile(configPath: string): string {
  const absolute = vibator.module.resolve(configPath);
  if (!existsSync(absolute)) {
    throw new Error(
      `no dependency-cruiser configuration file at ${configPath}`,
    );
  }
  return absolute;
}

/**
 * Resolves the configuration file a run uses.
 *
 * @param configPath - The configured path, when one is set.
 * @returns The absolute path, or undefined when no configuration exists.
 * @throws When a configured path names no file or an uninstalled package.
 */
function resolveConfigFile(configPath?: string): string | undefined {
  if (configPath !== undefined) return configuredFile(configPath);
  for (const name of DEFAULT_CONFIG_NAMES) {
    const absolute = join(vibator.project.root, name);
    if (existsSync(absolute)) return absolute;
  }
  return undefined;
}

/**
 * The cruise options for a run, loading and caching the configuration file.
 *
 * @param options - The namespace options.
 * @returns The cruise options, validated against the loaded ruleset.
 */
function cruiseOptions(options?: DepcruiseOptions): Promise<ICruiseOptions> {
  if (options?.config) {
    return Promise.resolve({ validate: true, ...options.config });
  }
  const key = options?.configPath ?? "";
  let pending = optionsCache.get(key);
  if (!pending) {
    const file = resolveConfigFile(options?.configPath);
    pending =
      file === undefined
        ? Promise.resolve({ validate: false })
        : extractDepcruiseOptions(file);
    optionsCache.set(key, pending);
  }
  return pending;
}

/**
 * Absolutizes a cruise module name against the project root.
 *
 * @param name - The module name, relative to the cruise base directory.
 * @returns The absolute forward-slashed path.
 */
function absolute(name: string): string {
  const root = vibator.project.root;
  return (isAbsolute(name) ? name : join(root, name)).replaceAll("\\", "/");
}

/**
 * Maps a cruise result to violations with resolved paths.
 *
 * @param result - The cruise result.
 * @returns Every violation of the loaded ruleset.
 */
function toViolations(result: ICruiseResult): DepcruiseViolation[] {
  return result.summary.violations.map((violation) => ({
    rule: violation.rule.name,
    severity: violation.rule.severity,
    from: absolute(violation.from),
    to: absolute(violation.to),
    cycle: violation.cycle?.map((step) => step.name),
    comment: violation.comment,
  }));
}

/**
 * Command dependency-cruiser through its JavaScript API.
 */
export const depcruise = {
  /**
   * The absolute path of the configuration file a run resolves.
   *
   * @param options - The namespace options.
   * @returns The path, or undefined when an inline configuration applies or
   * no configuration exists.
   * @throws When a configured path names no file.
   */
  configFile(options?: DepcruiseOptions): string | undefined {
    if (options?.config) return undefined;
    return resolveConfigFile(options?.configPath);
  },

  /**
   * Whether the loaded ruleset contains rules that need the full module
   * graph (orphan and reachability rules) rather than the graph reachable
   * from a set of entry points.
   *
   * @param options - The namespace options.
   * @returns Whether a full cruise is required for a sound result.
   */
  async needsFullGraph(options?: DepcruiseOptions): Promise<boolean> {
    const resolved = await cruiseOptions(options);
    const ruleset = JSON.stringify(resolved.ruleSet ?? {});
    return ruleset.includes('"orphan"') || ruleset.includes('"reachable"');
  },

  /**
   * Cruises the dependency graph from the given entry points and returns
   * every violation of the loaded ruleset.
   *
   * @param entries - Absolute file or directory paths to start the cruise
   * from.
   * @param options - The namespace options.
   * @returns Every violation, with module paths absolutized.
   */
  async violations(
    entries: string[],
    options?: DepcruiseOptions,
  ): Promise<DepcruiseViolation[]> {
    if (entries.length === 0) return [];
    const resolved = await cruiseOptions(options);
    const result = await cruise(entries, {
      doNotFollow: { path: "node_modules" },
      ...resolved,
      baseDir: vibator.project.root,
    });
    if (typeof result.output === "string") {
      throw new Error(
        "dependency-cruiser returned an unexpected report format",
      );
    }
    return toViolations(result.output);
  },
};

/** The shape the depcruise namespace adds to `vibator`. */
export type DepcruiseNamespace = typeof depcruise;

Object.assign(vibator, { depcruise });
