/**
 * The `env-example-sync` rule: the example env file matches what the code
 * reads.
 *
 * @packageDocumentation
 */
import { join, relative } from "node:path";
import {
  type Diagnostic,
  defineRule,
  type File,
  type FileSet,
  scope,
  vibator,
} from "vibator";
import { z } from "zod";

const RULE_ID = "env-example-sync";

const options = scope.extend({
  /** The file documenting every configurable variable. */
  example: z
    .string()
    .default(".env.example")
    .describe("The file documenting every configurable variable"),
  /**
   * Variables supplied by the runtime, the bundler or CI, which no operator
   * sets. Defaults cover Node and the values Vite injects into the browser.
   */
  ambient: z
    .array(z.string())
    .default([
      "NODE_ENV",
      "CI",
      "PATH",
      "HOME",
      "PROD",
      "DEV",
      "MODE",
      "SSR",
      "BASE_URL",
    ])
    .describe(
      "Variables the runtime, bundler or CI supplies, never documented",
    ),
  /** Variables consumed outside the scanned sources, such as by compose. */
  externallyConsumed: z
    .array(z.string())
    .default([])
    .describe(
      "Variables consumed outside the scanned sources, e.g. by compose",
    ),
  /** Whether to report documented variables that nothing reads. */
  reportUnread: z
    .boolean()
    .default(true)
    .describe("Whether to report documented variables that nothing reads"),
});

/**
 * The ways configuration is read, as patterns over source text.
 *
 * @remarks The third entry covers `envNumber("NAME", fallback)` style helpers;
 * the last two cover the Deno and Bun runtimes. Matching is textual, so a name
 * assembled at runtime from a prefix is missed; spelling variable names out
 * in full is what keeps this rule honest.
 */
const READ_PATTERNS: readonly RegExp[] = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\]/g,
  /\benv[A-Za-z]*\(\s*["'`]([A-Z][A-Z0-9_]*)["'`]/g,
  /import\.meta\.env\.([A-Z][A-Z0-9]+[A-Z0-9_]*)/g,
  /Deno\.env\.get\(\s*["'`]([A-Z][A-Z0-9_]*)["'`]/g,
  /Bun\.env\.([A-Z][A-Z0-9_]*)/g,
];

/**
 * Finds names read through the single-name patterns.
 *
 * @param text - The source text, comments already masked.
 * @returns The environment names the text reads.
 */
function directReads(text: string): string[] {
  return READ_PATTERNS.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => match[1] ?? ""),
  ).filter((name) => name !== "");
}

/**
 * Finds names pulled out of the environment by destructuring.
 *
 * @remarks `const { API_URL, PORT = "3000" } = process.env` is the single most
 * common access pattern in Node code and matches none of the single-name
 * patterns, so it gets its own scan. Renames (`NAME: alias`) count under the
 * environment-side name, and only conventional ALL_CAPS names are taken; a
 * lowercase binding in the list is someone destructuring something else.
 * @param text - The source text, comments already masked.
 * @returns The environment names the destructuring reads.
 */
function destructuredReads(text: string): string[] {
  const bindings = [
    ...text.matchAll(
      /\{([^{}]*)\}\s*=\s*(?:process\.env|import\.meta\.env|Bun\.env)\b/g,
    ),
  ];
  return bindings
    .flatMap((match) => (match[1] ?? "").split(","))
    .map((entry) => entry.split(/[:=]/)[0]?.trim() ?? "")
    .filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name));
}

/**
 * Scans the sources for configuration reads, with comments masked so prose
 * naming a variable does not count.
 *
 * @param files - The files to scan.
 * @returns Variable names mapped to the first file reading each, relative to
 * the project root.
 */
function collectReads(files: FileSet): Map<string, string> {
  const readBy = new Map<string, string>();
  files.forEach((file) => {
    const text = vibator.text.maskComments(file);
    const path = relative(vibator.project.root, file.path);
    for (const name of [...directReads(text), ...destructuredReads(text)]) {
      if (!readBy.has(name)) readBy.set(name, path);
    }
  });
  return readBy;
}

/**
 * The variable names an example file documents, each with its line.
 *
 * @remarks Three forms count: a live `NAME=value`, a commented `# NAME=value`
 * showing a default, and a name leading an aligned comment table. The column
 * gap in the third is what separates a documented knob from prose that happens
 * to start with a capitalised word.
 * @param file - The example file.
 * @returns The documented names mapped to their 1-based lines.
 */
function documentedVariables(file: File): Map<string, number> {
  const documented = new Map<string, number>();
  for (const line of vibator.text.lines(file)) {
    const name =
      line.text.match(/^\s*#?\s*([A-Z][A-Z0-9_]{2,})\s*=/)?.[1] ??
      line.text.match(/^\s*#\s+([A-Z][A-Z0-9_]{2,})\s{2,}/)?.[1];
    if (name !== undefined && !documented.has(name)) {
      documented.set(name, line.number);
    }
  }
  return documented;
}

/**
 * The example file, if there is one.
 *
 * @param example - Path of the example file, relative to the project root.
 * @returns The file, or `undefined` when it does not exist.
 */
function exampleFile(example: string): File | undefined {
  const file = vibator.project.files.get(join(vibator.project.root, example));
  try {
    return file.bytes ? file : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reports reads with no example file to document them.
 *
 * @param readBy - Variables mapped to the file reading each.
 * @param ambient - Names the runtime supplies, never documented.
 * @param example - Path of the missing example file.
 * @returns One project-level diagnostic per non-ambient read.
 */
function missingExample(
  readBy: Map<string, string>,
  ambient: Set<string>,
  example: string,
): Diagnostic[] {
  return [...readBy]
    .filter(([name]) => !ambient.has(name))
    .map(([name, file]) => ({
      message: `${name} is read by ${file}, but ${example} does not exist`,
      expected: `A ${example} documenting every variable a deployment must supply`,
      fix: `Create ${example} and add ${name} to it`,
    }));
}

/**
 * Reports variables the code reads but the example file omits.
 *
 * @param readBy - Variables mapped to the file reading each.
 * @param documented - Documented names mapped to their lines.
 * @param ambient - Names the runtime supplies, never documented.
 * @param file - The example file.
 * @param example - Its path, relative to the project root.
 * @returns One diagnostic per undocumented read.
 */
function undocumentedReads(
  readBy: Map<string, string>,
  documented: Map<string, number>,
  ambient: Set<string>,
  file: File,
  example: string,
): Diagnostic[] {
  return [...readBy]
    .filter(([name]) => !documented.has(name) && !ambient.has(name))
    .map(([name, source]) => ({
      file: file.path,
      message: `${name} is read by ${source} but not documented here`,
      expected: `Every variable the code reads appears in ${example}`,
      fix: `Add ${name}, with a comment describing what it does and its default`,
    }));
}

/**
 * Reports documented variables nothing reads.
 *
 * @param readBy - Variables mapped to the file reading each.
 * @param documented - Documented names mapped to their lines.
 * @param external - Names consumed outside the scanned sources.
 * @param file - The example file.
 * @returns One diagnostic per unread entry no ignore marker silences.
 */
function unreadDocumentation(
  readBy: Map<string, string>,
  documented: Map<string, number>,
  external: Set<string>,
  file: File,
): Diagnostic[] {
  return [...documented]
    .filter(([name]) => !readBy.has(name) && !external.has(name))
    .filter(([, line]) => !vibator.ignore.line(file, line, RULE_ID))
    .map(([name, line]) => ({
      file: file.path,
      line,
      message: `${name} is documented here but read by no scanned source`,
      expected: "Documented variables are ones the code actually reads",
      fix: `Remove ${name}, or list it under this rule's "externallyConsumed" option if a compose file or entrypoint consumes it`,
    }));
}

export default defineRule({
  id: RULE_ID,
  title: "The example env file matches what the code reads",
  docs: "@vibator/recommended:docs/rules/env-example-sync.md",
  severity: "warn",
  options,
  check({
    include,
    exclude,
    example,
    ambient,
    externallyConsumed,
    reportUnread,
  }) {
    const globs = [...include, ...exclude.map((glob) => `!${glob}`)];
    const sources = vibator.project.files
      .match(globs)
      .filter((file) => !vibator.ignore.file(file, RULE_ID));
    if (sources.length === 0) return { diagnostics: [] };
    const readBy = collectReads(sources);
    const ambientSet = new Set(ambient);
    const file = exampleFile(example);
    if (file === undefined) {
      return { diagnostics: missingExample(readBy, ambientSet, example) };
    }
    if (vibator.ignore.file(file, RULE_ID)) return { diagnostics: [] };
    const documented = documentedVariables(file);
    return {
      diagnostics: [
        ...undocumentedReads(readBy, documented, ambientSet, file, example),
        ...(reportUnread
          ? unreadDocumentation(
              readBy,
              documented,
              new Set(externallyConsumed),
              file,
            )
          : []),
      ],
    };
  },
});
