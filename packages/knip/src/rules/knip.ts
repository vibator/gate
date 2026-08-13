/**
 * The `knip` rule: runs Knip once over the workspace through the
 * `vibator.knip` namespace and reports the issues that land on files in
 * scope, so `--staged`, `--changed`, and `--since` narrow the report the same
 * way they do for per-file rules. Under `--write` it lets Knip apply its
 * fixes and rechecks.
 *
 * @packageDocumentation
 */
import {
  vibator as base,
  type Diagnostic,
  defineRule,
  type Report,
} from "vibator";
import { z } from "zod";
import "../namespace/knip.ts";
import type { KnipIssue, KnipNamespace } from "../namespace/knip.ts";

const vibator = base as typeof base & { knip: KnipNamespace };

const RULE_ID = "knip";

const options = z.object({
  /** Path to a Knip configuration file, resolved from the project root. */
  configPath: z
    .string()
    .optional()
    .describe(
      "Reference to a Knip configuration file: a ./ path from the project root or a package:path reference; defaults to Knip's own discovery (knip.json, knip.ts, ...)",
    ),
});

/** The human wording per Knip issue bucket. */
const WORDING: Record<
  string,
  { message: (issue: KnipIssue) => string; fix: string }
> = {
  files: {
    message: () => "This file is unused: nothing in the project imports it",
    fix: "Delete the file, or add it to Knip's entry points",
  },
  dependencies: {
    message: (issue) => `The dependency ${issue.symbol} is unused`,
    fix: "Run vibator --write to let Knip remove it, or delete it from package.json",
  },
  devDependencies: {
    message: (issue) => `The devDependency ${issue.symbol} is unused`,
    fix: "Run vibator --write to let Knip remove it, or delete it from package.json",
  },
  optionalPeerDependencies: {
    message: (issue) =>
      `The optional peer dependency ${issue.symbol} is unused`,
    fix: "Delete it from package.json",
  },
  unlisted: {
    message: (issue) =>
      `The dependency ${issue.symbol} is used but not listed in package.json`,
    fix: "Add it to the dependencies of package.json",
  },
  binaries: {
    message: (issue) =>
      `The binary ${issue.symbol} is used but its package is not listed`,
    fix: "Add the package providing the binary to package.json",
  },
  unresolved: {
    message: (issue) => `The import ${issue.symbol} does not resolve`,
    fix: "Fix the specifier, or install the package it names",
  },
  exports: {
    message: (issue) => `The export ${issue.symbol} is unused`,
    fix: "Run vibator --write to let Knip strip it, or remove the export keyword",
  },
  types: {
    message: (issue) => `The exported type ${issue.symbol} is unused`,
    fix: "Run vibator --write to let Knip strip it, or remove the export keyword",
  },
  enumMembers: {
    message: (issue) =>
      `The enum member ${issue.parentSymbol}.${issue.symbol} is unused`,
    fix: "Remove the member",
  },
  classMembers: {
    message: (issue) =>
      `The class member ${issue.parentSymbol}.${issue.symbol} is unused`,
    fix: "Remove the member",
  },
  duplicates: {
    message: (issue) => `The export ${issue.symbol} is duplicated`,
    fix: "Keep one of the duplicate exports",
  },
};

/**
 * Maps one Knip issue to a vibator diagnostic.
 *
 * @param issue - The Knip issue.
 * @returns The diagnostic.
 */
function toDiagnostic(issue: KnipIssue): Diagnostic {
  const wording = WORDING[issue.type];
  return {
    file: issue.filePath,
    line: issue.line,
    column: issue.col,
    message: wording
      ? `${wording.message(issue)} (knip/${issue.type})`
      : `Knip reports ${issue.type} for ${issue.symbol || issue.filePath}`,
    expected: "Knip finds no unused or unresolved code in the project",
    fix: wording?.fix ?? "Resolve the issue Knip reports",
  };
}

/**
 * The report for a configuration that fails to load.
 *
 * @param error - The error the configuration load threw.
 * @returns A report with one project-level diagnostic.
 */
function configurationReport(error: unknown): Report {
  const message = error instanceof Error ? error.message : String(error);
  return {
    diagnostics: [
      {
        message: `Knip configuration could not be loaded: ${message}`,
        expected: "configPath names an existing Knip configuration file",
        fix: "Point configPath at a Knip configuration, or remove the option to let Knip discover its own",
      },
    ],
  };
}

/**
 * The diagnostic for one issue, when it lands on a file in scope that no
 * ignore marker silences.
 *
 * @param issue - The Knip issue.
 * @param scoped - The absolute paths of the files in scope.
 * @returns The diagnostic, or undefined when the issue is not reported.
 */
function issueDiagnostic(
  issue: KnipIssue,
  scoped: Set<string>,
): Diagnostic | undefined {
  const path = issue.filePath.replaceAll("\\", "/");
  if (!scoped.has(path)) return undefined;
  const file = vibator.project.files.get(path);
  if (vibator.ignore.file(file, RULE_ID)) return undefined;
  if (
    issue.line !== undefined &&
    vibator.ignore.line(file, issue.line, RULE_ID)
  ) {
    return undefined;
  }
  return toDiagnostic({ ...issue, filePath: path });
}

export default defineRule({
  id: RULE_ID,
  title: "Knip finds no unused code or dependencies",
  docs: "@vibator/knip:docs/rules/knip.md",
  options,
  async check({ configPath }) {
    try {
      vibator.knip.configFile({ configPath });
    } catch (error) {
      return configurationReport(error);
    }
    const scoped = new Set(vibator.project.files.paths());
    const issues = await vibator.knip.issues({ configPath });
    const diagnostics = issues
      .map((issue) => issueDiagnostic(issue, scoped))
      .filter((diagnostic) => diagnostic !== undefined);
    return { diagnostics };
  },
  async fix({ configPath }, report) {
    if (
      !report.diagnostics.some((diagnostic) => diagnostic.file !== undefined)
    ) {
      return;
    }
    await vibator.knip.fix({ configPath });
  },
});
