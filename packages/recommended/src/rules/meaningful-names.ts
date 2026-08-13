/**
 * The `meaningful-names` rule: identifiers the project declares carry
 * meaning.
 *
 * @packageDocumentation
 */
import {
  vibator as base,
  type Diagnostic,
  defineRule,
  type File,
  scope,
} from "vibator";
import { z } from "zod";
import "../namespace/recommended.ts";
import type { RecommendedNamespace } from "../namespace/recommended.ts";

const vibator = base as typeof base & { recommended: RecommendedNamespace };

const RULE_ID = "meaningful-names";

const options = scope.extend({
  /** Declaration files mirror external APIs, so they are excluded. */
  exclude: z
    .array(z.string())
    .default(["**/*.test.*", "**/*.spec.*", "**/*.d.ts"])
    .describe("Glob patterns removed from that selection"),
  /** Identifiers shorter than this must be allowlisted. */
  minLength: z
    .number()
    .int()
    .positive()
    .default(3)
    .describe("Identifiers shorter than this must be allowlisted"),
  /** Short names that carry meaning, or that a library imposes. */
  allow: z
    .array(z.string())
    .default(["id", "ip", "ok", "db", "on", "to", "up", "x", "y", "z"])
    .describe("Short names that carry meaning, or that a library imposes"),
  /** Names long enough to pass the bar but still meaningless. */
  deny: z
    .array(z.string())
    .default([
      "data",
      "temp",
      "tmp",
      "arr",
      "obj",
      "val",
      "err",
      "res",
      "req",
      "evt",
      "idx",
      "num",
      "str",
      "buf",
      "elem",
      "btn",
      "msg",
      "env",
      "ret",
      "ctx",
      "cfg",
      "opts",
      "info",
      "misc",
      "stuff",
      "foo",
      "bar",
      "baz",
    ])
    .describe("Names long enough to pass the bar but still meaningless"),
});

/** The resolved options this rule works from. */
type Options = z.infer<typeof options>;

/**
 * The problem with a name, if there is one.
 *
 * @param name - The declared identifier text.
 * @param opts - The rule's options.
 * @returns A description of the problem, or `undefined` when the name is
 * fine.
 */
function problemWith(name: string, opts: Options): string | undefined {
  if (name.startsWith("_")) return undefined;
  if (opts.deny.includes(name)) {
    return `"${name}" is a filler name that says nothing about the value`;
  }
  if (name.length < opts.minLength && !opts.allow.includes(name)) {
    return `"${name}" is too short to carry meaning`;
  }
  return undefined;
}

/**
 * Judges every declared name in one file.
 *
 * @param file - The file to judge.
 * @param opts - The rule's options.
 * @returns The diagnostics for the file.
 */
function fileDiagnostics(file: File, opts: Options): Diagnostic[] {
  return vibator.recommended.declaredNames(file).flatMap((declared) => {
    const problem = problemWith(declared.name, opts);
    if (problem === undefined) return [];
    if (vibator.ignore.node(declared.node, RULE_ID)) return [];
    return [
      {
        file: file.path,
        line: declared.line,
        message: problem,
        expected: "A name that says what the value is",
        fix: "Rename it, or add `// vibator-ignore meaningful-names: <reason>` above if it genuinely earns the exception",
      },
    ];
  });
}

export default defineRule({
  id: RULE_ID,
  title: "Identifiers the project declares carry meaning",
  docs: "@vibator/recommended:docs/rules/meaningful-names.md",
  options,
  check(opts) {
    const globs = [...opts.include, ...opts.exclude.map((glob) => `!${glob}`)];
    const diagnostics: Diagnostic[] = [];
    vibator.project.files.match(globs).forEach((file) => {
      if (vibator.ignore.file(file, RULE_ID)) return;
      diagnostics.push(...fileDiagnostics(file, opts));
    });
    return { diagnostics };
  },
});
