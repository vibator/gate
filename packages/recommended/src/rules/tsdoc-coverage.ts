/**
 * The `tsdoc-coverage` rule: every declaration carries a complete TSDoc
 * contract.
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
import type {
  RecommendedNamespace,
  TsdocOptions,
} from "../namespace/recommended.ts";

const vibator = base as typeof base & { recommended: RecommendedNamespace };

const RULE_ID = "tsdoc-coverage";

const options = scope.extend({
  /** Declaration files document an external surface, so they are excluded. */
  exclude: z
    .array(z.string())
    .default(["**/*.test.*", "**/*.spec.*", "**/*.d.ts"])
    .describe("Glob patterns removed from that selection"),
  /**
   * Which declarations must carry documentation. `exported` asks only for the
   * surface other files consume, which is the gentler bar for a codebase
   * adopting the rule late.
   */
  requireOn: z
    .enum(["all", "exported"])
    .default("all")
    .describe("Which declarations must carry documentation"),
  /** Whether every parameter needs a `@param` tag. */
  requireParams: z
    .boolean()
    .default(true)
    .describe("Whether every parameter needs a @param tag"),
  /** Whether value-returning signatures need a `@returns` tag. */
  requireReturns: z
    .boolean()
    .default(true)
    .describe("Whether value-returning signatures need a @returns tag"),
  /** Longest run of consecutive own-line `//` comments allowed. */
  maxInlineCommentLines: z
    .number()
    .int()
    .positive()
    .default(2)
    .describe("Longest run of consecutive own-line // comments allowed"),
});

/**
 * Judges one file against the documentation bar.
 *
 * @param file - The file to judge.
 * @param tsdocOptions - The analysis options.
 * @returns The diagnostics for the file.
 */
function fileDiagnostics(file: File, tsdocOptions: TsdocOptions): Diagnostic[] {
  return vibator.recommended
    .tsdocViolations(file, tsdocOptions)
    .filter((violation) => !vibator.ignore.line(file, violation.line, RULE_ID))
    .map((violation) => ({
      file: file.path,
      line: violation.line,
      message: `${violation.symbol}: ${violation.problem}`,
      expected:
        "A TSDoc block stating the contract, with @param and @returns where due",
      fix: "Document the declaration; `//` above a declaration is documentation in the wrong form",
    }));
}

export default defineRule({
  id: RULE_ID,
  title: "Every declaration carries a complete TSDoc contract",
  docs: "@vibator/recommended:docs/rules/tsdoc-coverage.md",
  options,
  check({
    include,
    exclude,
    requireOn,
    requireParams,
    requireReturns,
    maxInlineCommentLines,
  }) {
    const tsdocOptions: TsdocOptions = {
      requireOn,
      requireParams,
      requireReturns,
      maxInlineCommentLines,
    };
    const globs = [...include, ...exclude.map((glob) => `!${glob}`)];
    const diagnostics: Diagnostic[] = [];
    vibator.project.files.match(globs).forEach((file) => {
      if (vibator.ignore.file(file, RULE_ID)) return;
      diagnostics.push(...fileDiagnostics(file, tsdocOptions));
    });
    return { diagnostics };
  },
});
