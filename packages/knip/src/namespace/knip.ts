/**
 * The `knip` subnamespace: a gateway to Knip driven through its programmatic
 * API, never through a shell command.
 *
 * Knip analyzes the whole workspace ("unused" is a global property), so the
 * namespace runs it once per configuration and callers intersect the issues
 * with the files in scope.
 *
 * Importing this module registers the namespace onto the shared `vibator`
 * object, so rules reach it as `vibator.knip`.
 *
 * @packageDocumentation
 */
import { existsSync } from "node:fs";
import type { Issue } from "knip";
import { vibator } from "vibator";

/** The Issues shape a Knip run returns: records bucketed by issue type. */
type Issues = Record<
  string,
  Set<string> | Record<string, Record<string, Issue>>
>;

/**
 * The `main` entry Knip's CLI runs on. The runtime exports it, but the
 * public type declarations omit it, so the import is typed here.
 *
 * @returns Knip's main function.
 */
async function knipMain(): Promise<
  (options: unknown) => Promise<{ issues: Issues }>
> {
  const module = (await import("knip")) as unknown as {
    main: (options: unknown) => Promise<{ issues: Issues }>;
  };
  return module.main;
}

/** The options every knip namespace call accepts. */
export interface KnipOptions {
  /**
   * Reference to a Knip configuration file: a `./` path from the project
   * root, an absolute path, or a `package:path` reference. When omitted,
   * Knip discovers its own configuration (`knip.json`, `knip.ts`, the
   * `knip` field in `package.json`, …).
   */
  configPath?: string;
}

/** One Knip issue with its file and position. */
export interface KnipIssue {
  /** The issue bucket, such as `exports`, `files`, or `dependencies`. */
  type: string;
  /** The absolute path of the file the issue points at. */
  filePath: string;
  /** The symbol the issue is about: an export, a dependency, a specifier. */
  symbol: string;
  /** The enclosing symbol, for enum and class members. */
  parentSymbol?: string;
  /** The 1-based line, when Knip resolves a position. */
  line?: number;
  /** The 1-based column, when Knip resolves a position. */
  col?: number;
  /** Whether Knip can remove the issue itself under a fix run. */
  fixable: boolean;
}

/** The issue buckets Knip can fix when asked to. */
const FIXABLE_TYPES = new Set([
  "exports",
  "types",
  "dependencies",
  "devDependencies",
]);

/** One Knip result per configuration path, reused across calls in a run. */
const cache = new Map<string, Promise<KnipIssue[]>>();

/**
 * Resolves the configuration file a run uses.
 *
 * @param configPath - The configured path, when one is set.
 * @returns The absolute path, or undefined to let Knip discover its own.
 * @throws When a configured path names no file.
 */
function resolveConfigFile(configPath?: string): string | undefined {
  if (configPath === undefined) return undefined;
  const absolute = vibator.module.resolve(configPath);
  if (!existsSync(absolute)) {
    throw new Error(`no Knip configuration file at ${configPath}`);
  }
  return absolute;
}

/**
 * Builds the resolved options a Knip run takes.
 *
 * @param options - The namespace options.
 * @param fix - Whether the run applies Knip's fixes.
 * @returns The resolved Knip main options.
 */
async function mainOptions(options?: KnipOptions, fix = false) {
  const { createOptions } = await import("knip/session");
  const configFile = resolveConfigFile(options?.configPath);
  return createOptions({
    cwd: vibator.project.root,
    isFix: fix,
    isCache: false,
    isShowProgress: false,
    ...(configFile !== undefined ? { args: { config: configFile } } : {}),
  });
}

/**
 * Flattens one bucket of issue records into a list.
 *
 * @param type - The bucket name, such as `exports` or `files`.
 * @param records - The bucket's records: a file set or per-file symbol maps.
 * @returns Every issue in the bucket.
 */
function flattenBucket(
  type: string,
  records: Set<string> | Record<string, Record<string, Issue>>,
): KnipIssue[] {
  if (records instanceof Set) {
    return [...records].map((filePath) => ({
      type,
      filePath,
      symbol: "",
      fixable: false,
    }));
  }
  return Object.values(records).flatMap((bySymbol) =>
    Object.values(bySymbol).map((issue) => ({
      type,
      filePath: issue.filePath,
      symbol: issue.symbol,
      parentSymbol: issue.parentSymbol,
      line: issue.line,
      col: issue.col,
      fixable: FIXABLE_TYPES.has(type),
    })),
  );
}

/**
 * Flattens Knip's bucketed issue records into one list.
 *
 * @param issues - The bucketed issues a Knip run returns.
 * @returns Every issue with its bucket name.
 */
function flatten(issues: Issues): KnipIssue[] {
  return Object.entries(issues).flatMap(([type, records]) =>
    flattenBucket(type, records),
  );
}

/**
 * Command Knip through its programmatic API.
 */
export const knip = {
  /**
   * The absolute path of the configuration file a run uses.
   *
   * @param options - The namespace options.
   * @returns The path, or undefined when Knip discovers its own.
   * @throws When a configured path names no file.
   */
  configFile(options?: KnipOptions): string | undefined {
    return resolveConfigFile(options?.configPath);
  },

  /**
   * Analyzes the workspace and returns every issue Knip reports.
   *
   * The result is cached per configuration for the duration of the run;
   * `fix` invalidates it.
   *
   * @param options - The namespace options.
   * @returns Every issue, flattened across Knip's buckets.
   */
  issues(options?: KnipOptions): Promise<KnipIssue[]> {
    const key = options?.configPath ?? "";
    let pending = cache.get(key);
    if (!pending) {
      pending = Promise.all([knipMain(), mainOptions(options)])
        .then(([main, resolved]) => main(resolved))
        .then((result) => flatten(result.issues));
      cache.set(key, pending);
    }
    return pending;
  },

  /**
   * Runs Knip with its fixes enabled: unused exports and types are stripped
   * and unused dependencies removed from `package.json`. Knip writes the
   * files itself; the cached analysis is invalidated.
   *
   * @param options - The namespace options.
   */
  async fix(options?: KnipOptions): Promise<void> {
    const main = await knipMain();
    const resolved = await mainOptions(options, true);
    await main(resolved);
    cache.clear();
  },
};

/** The shape the knip namespace adds to `vibator`. */
export type KnipNamespace = typeof knip;

Object.assign(vibator, { knip });
