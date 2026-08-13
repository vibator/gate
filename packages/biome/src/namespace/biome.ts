/**
 * The `biome` subnamespace: a gateway to the Biome linter driven through its
 * JavaScript SDK (`@biomejs/js-api`), never through a shell command.
 *
 * Importing this module registers the namespace onto the shared `vibator`
 * object, so rules reach it as `vibator.biome`.
 *
 * @packageDocumentation
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Diagnostic as BiomeSdkDiagnostic,
  Configuration,
} from "@biomejs/js-api/nodejs";
import { Biome } from "@biomejs/js-api/nodejs";
import { type File, vibator } from "vibator";

type ProjectKey = ReturnType<Biome["openProject"]>["projectKey"];

/** The options every biome namespace call accepts. */
export interface BiomeOptions {
  /**
   * A complete Biome configuration passed programmatically. Takes precedence
   * over `configPath` and the root configuration files.
   */
  config?: Configuration;
  /**
   * Reference to a Biome configuration file: a `./` path from the project
   * root, an absolute path, a `package:path` reference such as
   * `@vibator/gate:biome.base.json`, or a package export such as
   * `@vibator/gate/biome`. When omitted, `biome.json` then `biome.jsonc` at
   * the project root are used, and Biome's defaults apply when neither
   * exists.
   */
  configPath?: string;
}

/** One Biome finding with its position resolved to line and column. */
export interface BiomeFinding {
  /** The Biome category, such as `lint/style/useConst`. */
  category?: string;
  /** The severity Biome assigns the finding. */
  severity: "hint" | "information" | "warning" | "error" | "fatal";
  /** The plain-text description of the finding. */
  description: string;
  /** The 1-based line the finding starts on. */
  line?: number;
  /** The 1-based line the finding ends on, when it spans several. */
  endLine?: number;
  /** The 1-based column the finding starts on. */
  column?: number;
  /** Whether Biome carries a fix for the finding. */
  fixable: boolean;
}

interface Session {
  instance: Biome;
  projectKey: ProjectKey;
}

/** One Biome workspace per configuration path, reused across calls. */
const sessions = new Map<string, Session>();

/**
 * Blanks `//` and block comments outside strings, so `.jsonc` parses.
 *
 * @param text - The raw configuration text.
 * @returns The text with comments removed.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: a character scanner with four states reads clearest as one loop
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: splitting the scanner would spread one state machine across functions
function stripJsonComments(text: string): string {
  let result = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (inLine) {
      if (char === "\n") {
        inLine = false;
        result += char;
      }
      continue;
    }
    if (inBlock) {
      if (char === "*" && next === "/") {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      result += char;
      if (char === "\\" && next !== undefined) {
        result += next;
        i++;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === "/" && next === "/") {
      inLine = true;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlock = true;
      i++;
      continue;
    }
    result += char;
  }
  return result;
}

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
    throw new Error(`no Biome configuration file at ${configPath}`);
  }
  return absolute;
}

/**
 * Resolves the configuration file a run uses.
 *
 * @param configPath - The configured path, when one is set.
 * @returns The absolute path, or undefined when Biome's defaults apply.
 * @throws When a configured path names no file or an uninstalled package.
 */
function resolveConfigFile(configPath?: string): string | undefined {
  if (configPath !== undefined) return configuredFile(configPath);
  for (const name of ["biome.json", "biome.jsonc"]) {
    const absolute = join(vibator.project.root, name);
    if (existsSync(absolute)) return absolute;
  }
  return undefined;
}

/**
 * Parses a Biome configuration file, accepting `.jsonc` comments.
 *
 * @param path - The absolute path of the configuration file.
 * @returns The parsed configuration.
 */
function parseConfigFile(path: string): Configuration {
  const raw = readFileSync(path, "utf8");
  try {
    return JSON.parse(stripJsonComments(raw)) as Configuration;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid Biome configuration at ${path}: ${message}`);
  }
}

/**
 * Merges two Biome configurations the way Biome's own extends does: objects
 * merge by key with the override winning, and `overrides` entries
 * concatenate.
 *
 * @param base - The configuration merged first.
 * @param override - The configuration whose values win.
 * @returns The merged configuration.
 */
function mergeConfigurations(
  base: Configuration,
  override: Configuration,
): Configuration {
  const merged: Configuration = vibator.object.merge(base, override);
  const overrides = [...(base.overrides ?? []), ...(override.overrides ?? [])];
  if (overrides.length > 0) merged.overrides = overrides;
  return merged;
}

/**
 * Parses a configuration file and flattens its extends chain, because the
 * Biome workspace applies a configuration object without resolving extends.
 * An entry resolves from the configuration file naming it: a relative path,
 * an absolute path, or a package specifier such as `@vibator/gate/biome`.
 *
 * @param path - The absolute path of the configuration file.
 * @param seen - The files already parsed along the chain.
 * @returns The configuration with every extended file merged in.
 * @throws When a file fails to parse, an entry fails to resolve, or the
 * chain is circular.
 */
function flattenConfigFile(path: string, seen: Set<string>): Configuration {
  if (seen.has(path)) {
    throw new Error(`circular Biome extends at ${path}`);
  }
  seen.add(path);
  const { extends: entries, ...own } = parseConfigFile(
    path,
  ) as Configuration & {
    extends?: string[] | string;
  };
  let merged: Configuration = {};
  for (const entry of typeof entries === "string"
    ? [entries]
    : (entries ?? [])) {
    const file = vibator.module.resolve(entry, path);
    merged = mergeConfigurations(merged, flattenConfigFile(file, seen));
  }
  return mergeConfigurations(merged, own);
}

/**
 * The Biome workspace for a configuration, created once and reused.
 *
 * @param options - The namespace options.
 * @returns The live session.
 */
function session(options?: BiomeOptions): Session {
  const key = options?.config
    ? `inline:${JSON.stringify(options.config)}`
    : `path:${options?.configPath ?? ""}`;
  const existing = sessions.get(key);
  if (existing) return existing;
  const configuration =
    options?.config ??
    (() => {
      const file = resolveConfigFile(options?.configPath);
      return file !== undefined
        ? flattenConfigFile(file, new Set())
        : undefined;
    })();
  const instance = new Biome();
  const { projectKey } = instance.openProject(vibator.project.root);
  if (configuration !== undefined) {
    instance.applyConfiguration(projectKey, configuration);
  }
  const created = { instance, projectKey };
  sessions.set(key, created);
  return created;
}

/**
 * Converts a Biome byte span to line and column positions in a file.
 *
 * @param file - The file the span points into.
 * @param bytes - The file content encoded as UTF-8 bytes.
 * @param span - The `[start, end]` byte offsets.
 * @returns The start line, end line, and start column.
 */
function positions(
  file: File,
  bytes: Buffer,
  span: [number, number],
): Pick<BiomeFinding, "line" | "endLine" | "column"> {
  const ascii = bytes.length === file.content.length;
  const start = ascii ? span[0] : bytes.toString("utf8", 0, span[0]).length;
  const end = ascii ? span[1] : bytes.toString("utf8", 0, span[1]).length;
  const from = vibator.text.positionAt(file, start);
  const to = vibator.text.positionAt(file, end);
  return {
    line: from.line,
    endLine: to.line > from.line ? to.line : undefined,
    column: from.column,
  };
}

/**
 * Maps one SDK diagnostic to a finding with resolved positions.
 *
 * @param diagnostic - The SDK diagnostic.
 * @param file - The file the diagnostic points into.
 * @param bytes - The file content encoded as UTF-8 bytes.
 * @returns The finding.
 */
function toFinding(
  diagnostic: BiomeSdkDiagnostic,
  file: File,
  bytes: Buffer,
  fixable: boolean,
): BiomeFinding {
  const span = diagnostic.location.span;
  return {
    category: diagnostic.category,
    severity: diagnostic.severity,
    description: diagnostic.description,
    fixable,
    ...(span ? positions(file, bytes, span) : {}),
  };
}

/**
 * Counts diagnostics per category.
 *
 * @param diagnostics - The diagnostics to count.
 * @returns The count keyed by category.
 */
function countByCategory(
  diagnostics: BiomeSdkDiagnostic[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const diagnostic of diagnostics) {
    const key = diagnostic.category ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Command the Biome linter through its SDK.
 */
export const biome = {
  /**
   * The absolute path of the configuration file a run resolves.
   *
   * @param options - The namespace options.
   * @returns The path, or undefined when an inline configuration or Biome's
   * defaults apply.
   * @throws When a configured path names no file, fails to parse, or names
   * an extends chain that fails to resolve.
   */
  configFile(options?: BiomeOptions): string | undefined {
    if (options?.config) return undefined;
    const path = resolveConfigFile(options?.configPath);
    if (path !== undefined) flattenConfigFile(path, new Set());
    return path;
  },

  /**
   * Lints a file and returns Biome's findings with positions resolved.
   *
   * @param file - The file to lint.
   * @param options - The namespace options.
   * @returns Every finding Biome reports for the file.
   */
  lint(file: File, options?: BiomeOptions): BiomeFinding[] {
    const { instance, projectKey } = session(options);
    const result = instance.lintContent(projectKey, file.content, {
      filePath: file.path,
    });
    const afterSafeFixes = instance.lintContent(projectKey, file.content, {
      filePath: file.path,
      fixFileMode: "safeFixes",
    });
    const remaining = countByCategory(afterSafeFixes.diagnostics);
    const reported = countByCategory(result.diagnostics);
    const bytes = Buffer.from(file.content, "utf8");
    return result.diagnostics.map((diagnostic) => {
      const key = diagnostic.category ?? "";
      const fixable = (remaining.get(key) ?? 0) < (reported.get(key) ?? 0);
      return toFinding(diagnostic, file, bytes, fixable);
    });
  },

  /**
   * The file content with Biome's safe fixes applied.
   *
   * @param file - The file to fix.
   * @param options - The namespace options.
   * @returns The fixed content; unchanged when nothing is fixable.
   */
  fix(file: File, options?: BiomeOptions): string {
    const { instance, projectKey } = session(options);
    const result = instance.lintContent(projectKey, file.content, {
      filePath: file.path,
      fixFileMode: "safeFixes",
    });
    return result.content;
  },
};

/** The shape the biome namespace adds to `vibator`. */
export type BiomeNamespace = typeof biome;

Object.assign(vibator, { biome });
