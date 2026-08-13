/**
 * The `depcruise` rule: cruises the dependency graph through the
 * `vibator.depcruise` namespace and maps each ruleset violation to a vibator
 * diagnostic. The files in scope become the cruise entry points, so
 * `--staged`, `--changed`, and `--since` narrow the analysis, unless the
 * ruleset contains orphan or reachability rules, which need the full graph;
 * the cruise then starts from the project root and only the report narrows.
 *
 * @packageDocumentation
 */
import {
  vibator as base,
  type Diagnostic,
  defineRule,
  type File,
  type FileSet,
  type Report,
  scope,
} from "vibator";
import { z } from "zod";
import "../namespace/depcruise.ts";
import type {
  DepcruiseNamespace,
  DepcruiseOptions,
  DepcruiseViolation,
} from "../namespace/depcruise.ts";

const vibator = base as typeof base & { depcruise: DepcruiseNamespace };

const RULE_ID = "depcruise";

const options = scope.extend({
  /** Reference to a dependency-cruiser configuration file: `./` path, `package:path`, or package export. */
  configPath: z
    .string()
    .optional()
    .describe(
      "Reference to a dependency-cruiser configuration file: a ./ path from the project root, a package:path reference, or a package export; defaults to .dependency-cruiser.{js,cjs,mjs,json} at the root",
    ),
  /** Complete cruise options passed inline, overriding configPath. */
  config: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Complete dependency-cruiser cruise options (ruleset under ruleSet), taking precedence over configPath and the root configuration files",
    ),
});

/**
 * The 1-based line of the import statement in `from` that pulls in `to`,
 * located by matching the target's basename in import or require specifiers.
 *
 * @param file - The file the dependency starts from.
 * @param to - The absolute path of the module the dependency points at.
 * @returns The line, or undefined when no unambiguous match exists.
 */
function importLine(file: File, to: string): number | undefined {
  const stem = to
    .split("/")
    .at(-1)
    ?.replace(/\.[cm]?[jt]sx?$/, "");
  if (!stem) return undefined;
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:from\\s*|import\\s*\\(?|require\\s*\\()\\s*["'][^"']*\\b${escaped}(?:\\.[cm]?[jt]sx?)?["']`,
  );
  return vibator.text.matches(file, pattern)[0]?.line;
}

/**
 * Maps one violation to a vibator diagnostic.
 *
 * @param violation - The dependency-cruiser violation.
 * @param file - The file the violation starts from.
 * @param root - The absolute project root, for readable module names.
 * @returns The diagnostic.
 */
function toDiagnostic(
  violation: DepcruiseViolation,
  file: File,
  root: string,
): Diagnostic {
  const relative = (path: string) => path.replace(`${root}/`, "");
  const route = violation.cycle?.length
    ? ` (cycle: ${violation.cycle.join(" -> ")})`
    : "";
  return {
    file: file.path,
    line: importLine(file, violation.to),
    message: `Dependency ${relative(violation.from)} -> ${relative(violation.to)} violates ${violation.rule}${route}`,
    expected:
      violation.comment ??
      `The dependency graph satisfies the ${violation.rule} rule`,
    fix: "Restructure the dependency so the rule holds, or adjust the ruleset",
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
        message: `dependency-cruiser configuration could not be loaded: ${message}`,
        expected:
          "configPath names an existing dependency-cruiser configuration file",
        fix: "Point configPath at a configuration, or create .dependency-cruiser.js at the project root",
      },
    ],
  };
}

/**
 * The diagnostic for one violation, when it starts from a file in scope that
 * no ignore marker silences.
 *
 * @param violation - The dependency-cruiser violation.
 * @param files - The files in scope.
 * @param scoped - The absolute paths of the files in scope.
 * @returns The diagnostic, or undefined when the violation is not reported.
 */
function violationDiagnostic(
  violation: DepcruiseViolation,
  files: FileSet,
  scoped: Set<string>,
): Diagnostic | undefined {
  if (violation.severity === "info" || violation.severity === "ignore") {
    return undefined;
  }
  if (!scoped.has(violation.from)) return undefined;
  const file = files.get(violation.from);
  if (vibator.ignore.file(file, RULE_ID)) return undefined;
  const diagnostic = toDiagnostic(violation, file, vibator.project.root);
  if (
    diagnostic.line !== undefined &&
    vibator.ignore.line(file, diagnostic.line, RULE_ID)
  ) {
    return undefined;
  }
  return diagnostic;
}

export default defineRule({
  id: RULE_ID,
  title: "The dependency graph satisfies the cruiser ruleset",
  docs: "@vibator/depcruise:docs/rules/depcruise.md",
  options,
  async check({ include, exclude, configPath, config }) {
    const depcruiseOptions: DepcruiseOptions = {
      configPath,
      config: config as DepcruiseOptions["config"],
    };
    try {
      vibator.depcruise.configFile(depcruiseOptions);
    } catch (error) {
      return configurationReport(error);
    }
    const globs = [...include, ...exclude.map((glob) => `!${glob}`)];
    const files = vibator.project.files.match(globs);
    const scoped = new Set(files.paths());
    if (scoped.size === 0) return { diagnostics: [] };
    const entries = (await vibator.depcruise.needsFullGraph(depcruiseOptions))
      ? [vibator.project.root]
      : [...scoped];
    const violations = await vibator.depcruise.violations(
      entries,
      depcruiseOptions,
    );
    const diagnostics = violations
      .map((violation) => violationDiagnostic(violation, files, scoped))
      .filter((diagnostic) => diagnostic !== undefined);
    return { diagnostics };
  },
});
