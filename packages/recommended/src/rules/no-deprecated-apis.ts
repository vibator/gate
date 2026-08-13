/**
 * The `no-deprecated-apis` rule: no use of APIs marked `@deprecated`.
 *
 * @packageDocumentation
 */
import { join } from "node:path";
import {
  vibator as base,
  type Diagnostic,
  defineRule,
  type File,
  type Program,
  type Report,
  scope,
} from "vibator";
import { z } from "zod";
import "../namespace/recommended.ts";
import type { RecommendedNamespace } from "../namespace/recommended.ts";

const vibator = base as typeof base & { recommended: RecommendedNamespace };

const RULE_ID = "no-deprecated-apis";

const options = scope.extend({
  /** Declaration files describe APIs; using one there is not a usage. */
  exclude: z
    .array(z.string())
    .default(["**/*.test.*", "**/*.spec.*", "**/*.d.ts"])
    .describe("Glob patterns removed from that selection"),
  /**
   * The tsconfig files whose programs resolve the symbols. Several rules
   * naming the same project cost one type-check between them.
   */
  projects: z
    .array(z.string())
    .min(1)
    .default(["tsconfig.json"])
    .describe("tsconfig paths whose programs this rule resolves against"),
});

/**
 * The report for a project whose program cannot be built.
 *
 * @param project - The tsconfig path that failed.
 * @param error - The error the build threw.
 * @returns A report with one project-level diagnostic.
 */
function projectReport(project: string, error: unknown): Report {
  const message = error instanceof Error ? error.message : String(error);
  return {
    diagnostics: [
      {
        message: `Cannot build a program from ${project}: ${message}`,
        expected: "Every entry in the projects option names a valid tsconfig",
        fix: `Point the "projects" option at the right tsconfig, or turn the rule off`,
      },
    ],
  };
}

/**
 * Judges every deprecated usage in one file.
 *
 * @param program - The program the file belongs to.
 * @param file - The file to judge.
 * @returns The diagnostics for the file.
 */
function fileDiagnostics(program: Program, file: File): Diagnostic[] {
  return vibator.recommended
    .deprecatedUsages(program, file)
    .flatMap((usage) => {
      if (vibator.ignore.node(usage.node, RULE_ID)) return [];
      return [
        {
          file: file.path,
          line: usage.line,
          message: `${usage.name} is deprecated`,
          expected: usage.replacement,
          fix: `Replace ${usage.name}: ${usage.replacement}`,
        },
      ];
    });
}

export default defineRule({
  id: RULE_ID,
  title: "No use of APIs marked @deprecated",
  docs: "@vibator/recommended:docs/rules/no-deprecated-apis.md",
  options,
  check({ include, exclude, projects }) {
    const globs = [...include, ...exclude.map((glob) => `!${glob}`)];
    const seen = new Set<string>();
    const diagnostics: Diagnostic[] = [];
    for (const project of projects) {
      let program: Program;
      try {
        program = vibator.ts.program(
          vibator.project.files.get(join(vibator.project.root, project)),
        );
      } catch (error) {
        return projectReport(project, error);
      }
      program.files.match(globs).forEach((file) => {
        if (seen.has(file.path)) return;
        seen.add(file.path);
        if (vibator.ignore.file(file, RULE_ID)) return;
        diagnostics.push(...fileDiagnostics(program, file));
      });
    }
    return { diagnostics };
  },
});
