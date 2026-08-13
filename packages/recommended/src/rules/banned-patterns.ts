/**
 * The `banned-patterns` rule: flags lines matching patterns the project has
 * banned outright.
 *
 * @packageDocumentation
 */
import {
  type Diagnostic,
  defineRule,
  type File,
  type Report,
  scope,
  vibator,
} from "vibator";
import { z } from "zod";

const RULE_ID = "banned-patterns";

/** One banned pattern, with the three diagnostic fields it reports. */
const patternSchema = z.object({
  /** JavaScript regular expression source matched against each line. */
  pattern: z
    .string()
    .describe("JavaScript regular expression source, matched per line"),
  /** Regular expression flags, such as `i`. */
  flags: z.string().default("").describe("Regular expression flags, such as i"),
  /** What is wrong when the pattern matches. */
  message: z.string().describe("What is wrong when the pattern matches"),
  /** The standard, positively stated. */
  expected: z.string().describe("The standard, positively stated"),
  /** The concrete next action. */
  fix: z.string().describe("The concrete next action"),
});

/** One configured pattern. */
type BannedPattern = z.infer<typeof patternSchema>;

/** One configured pattern with its compiled expression. */
interface CompiledPattern {
  /** The configured pattern. */
  banned: BannedPattern;
  /** The compiled expression. */
  expression: RegExp;
}

const options = scope.extend({
  /** The patterns to ban, each carrying its own diagnostic text. */
  patterns: z
    .array(patternSchema)
    .default([])
    .describe("The patterns to ban, each carrying its own diagnostic text"),
});

/**
 * Compiles one configured pattern.
 *
 * @param banned - The configured pattern.
 * @returns The pattern with its compiled expression.
 * @throws When the pattern is not a valid regular expression.
 */
function compile(banned: BannedPattern): CompiledPattern {
  try {
    return { banned, expression: new RegExp(banned.pattern, banned.flags) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid pattern ${banned.pattern}: ${message}`);
  }
}

/**
 * The report for a pattern that fails to compile.
 *
 * @param error - The error the compilation threw.
 * @returns A report with one project-level diagnostic.
 */
function configurationReport(error: unknown): Report {
  const message = error instanceof Error ? error.message : String(error);
  return {
    diagnostics: [
      {
        message: `A banned pattern could not be compiled: ${message}`,
        expected:
          "Every configured pattern is a valid JavaScript regular expression",
        fix: "Fix the pattern in the rule's options",
      },
    ],
  };
}

/**
 * Finds every line one pattern matches, skipping ignored lines.
 *
 * @param file - The file being judged.
 * @param compiled - The pattern and its compiled expression.
 * @returns One diagnostic per matching line.
 */
function matchesOf(file: File, compiled: CompiledPattern): Diagnostic[] {
  return vibator.text.lines(file).flatMap((line) => {
    if (!compiled.expression.test(line.text)) return [];
    if (vibator.ignore.line(file, line.number, RULE_ID)) return [];
    return [
      {
        file: file.path,
        line: line.number,
        message: compiled.banned.message,
        expected: compiled.banned.expected,
        fix: compiled.banned.fix,
      },
    ];
  });
}

export default defineRule({
  id: RULE_ID,
  title: "Project-banned patterns stay out of the source",
  docs: "@vibator/recommended:docs/rules/banned-patterns.md",
  severity: "off",
  options,
  check({ include, exclude, patterns }) {
    let compiled: CompiledPattern[];
    try {
      compiled = patterns.map(compile);
    } catch (error) {
      return configurationReport(error);
    }
    const globs = [...include, ...exclude.map((glob) => `!${glob}`)];
    const diagnostics: Diagnostic[] = [];
    vibator.project.files.match(globs).forEach((file) => {
      if (vibator.text.binary(file)) return;
      if (vibator.ignore.file(file, RULE_ID)) return;
      for (const pattern of compiled) {
        diagnostics.push(...matchesOf(file, pattern));
      }
    });
    return { diagnostics };
  },
});
