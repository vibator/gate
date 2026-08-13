/**
 * The `locale-parity` rule: every locale carries the same keys as the source
 * locale.
 *
 * @packageDocumentation
 */
import { join } from "node:path";
import { type Diagnostic, defineRule, type File, vibator } from "vibator";
import { z } from "zod";

const RULE_ID = "locale-parity";

/** Longest key list printed per catalog before the rest is summarised. */
const MAX_REPORTED_KEYS = 8;

const options = z.object({
  /** Directory holding the locale catalogs. */
  root: z.string().describe("Directory holding the locale catalogs"),
  /** The locale every other is seeded from. */
  source: z
    .string()
    .default("en")
    .describe("The locale every other is seeded from"),
  /**
   * How the catalogs are laid out. `directory-per-locale` expects
   * `root/<locale>/<namespace>.json`; `file-per-locale` expects
   * `root/<locale>.json`.
   */
  layout: z
    .enum(["directory-per-locale", "file-per-locale"])
    .default("directory-per-locale")
    .describe(
      "directory-per-locale expects root/<locale>/<namespace>.json; " +
        "file-per-locale expects root/<locale>.json",
    ),
  /** The locales to check; discovered from the layout when omitted. */
  locales: z
    .array(z.string())
    .optional()
    .describe("The locales to check; discovered from the layout when omitted"),
});

/** The resolved options this rule works from. */
type Options = z.infer<typeof options>;

/** A translation namespace, nested to any depth. */
type TranslationTree = { [key: string]: string | TranslationTree };

/**
 * Flattens a nested namespace into dotted key paths.
 *
 * @param tree - The parsed namespace.
 * @param prefix - The path accumulated so far.
 * @returns Every leaf key path.
 */
function flattenKeys(tree: TranslationTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null
      ? flattenKeys(value, path)
      : [path];
  });
}

/**
 * Renders a key list, truncated so one bad catalog cannot bury the others.
 *
 * @param keys - The offending key paths.
 * @returns A comma-separated excerpt with a count of anything omitted.
 */
function summarise(keys: string[]): string {
  const shown = keys.slice(0, MAX_REPORTED_KEYS).join(", ");
  const hidden = keys.length - MAX_REPORTED_KEYS;
  return hidden > 0 ? `${shown} (+${hidden} more)` : shown;
}

/**
 * The file paths under the locales root, relative to it.
 *
 * @param localesRoot - The locales directory, relative to the project root.
 * @returns Each file path relative to the locales root.
 */
function pathsUnder(localesRoot: string): string[] {
  const prefix = `${join(vibator.project.root, localesRoot)}/`;
  return vibator.project.files
    .match(`${localesRoot}/**`)
    .paths()
    .map((path) => path.slice(prefix.length));
}

/**
 * The locales present under the configured root, per the layout.
 *
 * @param opts - The rule's options.
 * @param relative - The file paths under the root, relative to it.
 * @returns Locale codes, ignoring loose files such as a README.
 */
function discoverLocales(opts: Options, relative: string[]): string[] {
  if (opts.locales) return opts.locales;
  if (opts.layout === "file-per-locale") {
    return relative
      .filter((path) => !path.includes("/") && path.endsWith(".json"))
      .map((path) => path.slice(0, -".json".length));
  }
  const firstSegments = relative
    .filter((path) => path.includes("/"))
    .map((path) => path.split("/")[0] ?? "");
  return [...new Set(firstSegments)];
}

/**
 * Reads and parses one catalog file.
 *
 * @param path - The catalog path, relative to the project root.
 * @returns The file and its parsed tree, both undefined when the file is
 * absent or malformed.
 */
function readCatalog(path: string): { file?: File; tree?: TranslationTree } {
  try {
    const file = vibator.project.files.get(join(vibator.project.root, path));
    return { file, tree: vibator.json.parse(file) as TranslationTree };
  } catch {
    return {};
  }
}

/**
 * The diagnostic for keys the source has and a catalog does not.
 *
 * @param path - The absolute path of the catalog.
 * @param sourceLabel - Display name of the source catalog.
 * @param keys - The missing key paths.
 * @returns The diagnostic, or none when nothing is missing.
 */
function missingKeys(
  path: string,
  sourceLabel: string,
  keys: string[],
): Diagnostic[] {
  if (keys.length === 0) return [];
  return [
    {
      file: path,
      message: `${keys.length} key(s) missing vs ${sourceLabel}: ${summarise(keys)}`,
      expected: `Every key in ${sourceLabel}`,
      fix: "Add the missing keys, seeded with the source text until translated",
    },
  ];
}

/**
 * The diagnostic for keys a catalog has and the source does not.
 *
 * @param path - The absolute path of the catalog.
 * @param sourceLabel - Display name of the source catalog.
 * @param keys - The extra key paths.
 * @returns The diagnostic, or none when nothing is extra.
 */
function extraKeys(
  path: string,
  sourceLabel: string,
  keys: string[],
): Diagnostic[] {
  if (keys.length === 0) return [];
  return [
    {
      file: path,
      message: `${keys.length} key(s) absent from ${sourceLabel}: ${summarise(keys)}`,
      expected: `No keys beyond those in ${sourceLabel}`,
      fix: "Remove them, or add them to the source locale; this is usually a half-applied rename",
    },
  ];
}

/**
 * Compares one locale catalog against the source's keys.
 *
 * @param path - The catalog path, relative to the project root.
 * @param sourceLabel - Display name of the source catalog.
 * @param sourcePath - The source catalog path, for the fix text.
 * @param sourceKeys - The key paths the source defines.
 * @returns The findings for that catalog.
 */
function compareCatalog(
  path: string,
  sourceLabel: string,
  sourcePath: string,
  sourceKeys: string[],
): Diagnostic[] {
  const { file, tree } = readCatalog(path);
  if (file === undefined || tree === undefined) {
    return [
      {
        file: join(vibator.project.root, path),
        message: "Catalog missing or unparsable for this locale",
        expected: `A valid JSON catalog matching ${sourceLabel}`,
        fix: `Copy ${sourcePath} to ${path} and translate it`,
      },
    ];
  }
  if (vibator.ignore.file(file, RULE_ID)) return [];
  const localeKeys = new Set(flattenKeys(tree));
  const sourceKeySet = new Set(sourceKeys);
  return [
    ...missingKeys(
      file.path,
      sourceLabel,
      sourceKeys.filter((key) => !localeKeys.has(key)),
    ),
    ...extraKeys(
      file.path,
      sourceLabel,
      [...localeKeys].filter((key) => !sourceKeySet.has(key)),
    ),
  ];
}

/**
 * The diagnostic for a source locale that cannot be read.
 *
 * @param opts - The rule's options.
 * @returns The project-level diagnostic.
 */
function sourceUnreadable(opts: Options): Diagnostic {
  return {
    message: `Source locale "${opts.source}" cannot be read under ${opts.root}`,
    expected: "A source catalog every other locale is compared against",
    fix: `Check the "source" and "layout" options against the actual layout of ${opts.root}`,
  };
}

/**
 * Checks every locale laid out as one file per locale.
 *
 * @param opts - The rule's options.
 * @param locales - The locales to check, source excluded.
 * @returns The findings.
 */
function checkFileLayout(opts: Options, locales: string[]): Diagnostic[] {
  const sourcePath = `${opts.root}/${opts.source}.json`;
  const { tree } = readCatalog(sourcePath);
  if (tree === undefined) return [sourceUnreadable(opts)];
  const sourceKeys = flattenKeys(tree);
  return locales.flatMap((locale) =>
    compareCatalog(
      `${opts.root}/${locale}.json`,
      `${opts.source}.json`,
      sourcePath,
      sourceKeys,
    ),
  );
}

/**
 * Compares one locale's namespace catalog against the source's.
 *
 * @param opts - The rule's options.
 * @param locale - The locale to check.
 * @param namespace - The namespace file name, such as `common.json`.
 * @returns The findings for that catalog.
 */
function compareNamespace(
  opts: Options,
  locale: string,
  namespace: string,
): Diagnostic[] {
  const sourcePath = `${opts.root}/${opts.source}/${namespace}`;
  const { tree } = readCatalog(sourcePath);
  return compareCatalog(
    `${opts.root}/${locale}/${namespace}`,
    `${opts.source}/${namespace}`,
    sourcePath,
    flattenKeys(tree ?? {}),
  );
}

/**
 * Checks every locale laid out as one directory per locale.
 *
 * @param opts - The rule's options.
 * @param locales - The locales to check, source excluded.
 * @param relative - The file paths under the root, relative to it.
 * @returns The findings.
 */
function checkDirectoryLayout(
  opts: Options,
  locales: string[],
  relative: string[],
): Diagnostic[] {
  const namespaces = relative
    .filter(
      (path) => path.startsWith(`${opts.source}/`) && path.endsWith(".json"),
    )
    .map((path) => path.slice(opts.source.length + 1))
    .filter((namespace) => !namespace.includes("/"));
  if (namespaces.length === 0) return [sourceUnreadable(opts)];
  return locales.flatMap((locale) =>
    namespaces.flatMap((namespace) =>
      compareNamespace(opts, locale, namespace),
    ),
  );
}

export default defineRule({
  id: RULE_ID,
  title: "Every locale carries the same keys as the source",
  docs: "@vibator/recommended:docs/rules/locale-parity.md",
  severity: "off",
  options,
  check(opts) {
    const relative = pathsUnder(opts.root);
    if (relative.length === 0) {
      return {
        diagnostics: [
          {
            message: `Locales root "${opts.root}" cannot be read`,
            expected: "The rule's root option names the locales directory",
            fix: `Point this rule's "root" option at the directory holding the catalogs, or turn the rule off`,
          },
        ],
      };
    }
    const locales = discoverLocales(opts, relative).filter(
      (locale) => locale !== opts.source,
    );
    const diagnostics =
      opts.layout === "file-per-locale"
        ? checkFileLayout(opts, locales)
        : checkDirectoryLayout(opts, locales, relative);
    return { diagnostics };
  },
});
