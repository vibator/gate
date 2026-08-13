/**
 * The `prefer-array-methods` rule: a loop whose body is one statement is an
 * array method written long.
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

const RULE_ID = "prefer-array-methods";

const options = scope.extend({
  /** Declaration files carry no loop bodies worth judging. */
  exclude: z
    .array(z.string())
    .default(["**/*.test.*", "**/*.spec.*", "**/*.d.ts"])
    .describe("Glob patterns removed from that selection"),
});

/**
 * Judges every manual loop in one file.
 *
 * @param file - The file to judge.
 * @returns The diagnostics for the file.
 */
function fileDiagnostics(file: File): Diagnostic[] {
  return vibator.recommended.manualLoops(file).flatMap((loop) => {
    if (vibator.ignore.node(loop.node, RULE_ID)) return [];
    return [
      {
        file: file.path,
        line: loop.line,
        message:
          "Loop body is a single statement with no break, continue, return or await",
        expected: "An array method that names the operation",
        fix: "Use forEach, map, filter, flatMap or reduce, or add `// vibator-ignore prefer-array-methods: <reason>` above if the loop reads better",
      },
    ];
  });
}

export default defineRule({
  id: RULE_ID,
  title: "Array methods over single-statement loops",
  docs: "@vibator/recommended:docs/rules/prefer-array-methods.md",
  severity: "warn",
  options,
  check({ include, exclude }) {
    const globs = [...include, ...exclude.map((glob) => `!${glob}`)];
    const diagnostics: Diagnostic[] = [];
    vibator.project.files.match(globs).forEach((file) => {
      if (vibator.ignore.file(file, RULE_ID)) return;
      diagnostics.push(...fileDiagnostics(file));
    });
    return { diagnostics };
  },
});
