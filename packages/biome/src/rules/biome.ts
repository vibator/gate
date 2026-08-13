/**
 * The `biome` rule: orchestrates the Biome linter over the files in scope
 * through the `vibator.biome` namespace and maps its findings to vibator
 * diagnostics. Under `--write` it applies Biome's safe fixes.
 *
 * @packageDocumentation
 */
import {
  vibator as base,
  type Diagnostic,
  defineRule,
  type File,
  type Report,
  scope,
} from "vibator";
import { z } from "zod";
import "../namespace/biome.ts";
import type {
  BiomeFinding,
  BiomeNamespace,
  BiomeOptions,
} from "../namespace/biome.ts";

const vibator = base as typeof base & { biome: BiomeNamespace };

const RULE_ID = "biome";

const options = scope.extend({
  /** Reference to a Biome configuration file: `./` path, `package:path`, or package export. */
  configPath: z
    .string()
    .optional()
    .describe(
      "Reference to a Biome configuration file: a ./ path from the project root, a package:path reference, or a package export; defaults to biome.json or biome.jsonc at the root",
    ),
  /** A complete Biome configuration passed inline, overriding configPath. */
  config: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "A complete Biome configuration object, taking precedence over configPath and the root configuration files",
    ),
});

/**
 * The documentation URL of a Biome lint rule.
 *
 * @param category - The Biome category, such as `lint/style/useConst`.
 * @returns The URL, or undefined for non-lint categories.
 */
function ruleDocsUrl(category?: string): string | undefined {
  const name = category?.match(/^lint\/[^/]+\/(.+)$/)?.[1];
  if (!name) return undefined;
  const slug = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return `https://biomejs.dev/linter/rules/${slug}/`;
}

/**
 * Maps one Biome finding to a vibator diagnostic.
 *
 * @param finding - The Biome finding.
 * @param file - The file the finding points into.
 * @returns The diagnostic.
 */
function toDiagnostic(finding: BiomeFinding, file: File): Diagnostic {
  const docs = ruleDocsUrl(finding.category);
  return {
    file: file.path,
    line: finding.line,
    endLine: finding.endLine,
    column: finding.column,
    message: finding.category
      ? `${finding.description} (${finding.category})`
      : finding.description,
    expected: finding.category
      ? `The code satisfies Biome check ${finding.category}`
      : "The file passes Biome's checks",
    fix: finding.fixable
      ? "Run vibator --write to apply Biome's safe fix"
      : docs
        ? `Resolve it manually; see ${docs}`
        : "Resolve the issue Biome reports",
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
        message: `Biome configuration could not be loaded: ${message}`,
        expected: "configPath names a valid Biome configuration file",
        fix: "Point configPath at a Biome configuration, or create biome.json at the project root",
      },
    ],
  };
}

/**
 * The diagnostic for a file Biome fails to process.
 *
 * @param file - The file Biome tripped on.
 * @param error - The error the lint threw.
 * @returns The diagnostic.
 */
function processError(file: File, error: unknown): Diagnostic {
  const message = error instanceof Error ? error.message : String(error);
  return {
    file: file.path,
    message: `Biome could not process the file: ${message}`,
    expected: "Biome parses every file in scope",
    fix: "Exclude the file from the rule's scope, or fix what Biome trips on",
  };
}

/**
 * Whether a finding becomes a diagnostic: warnings and errors that no ignore
 * marker silences.
 *
 * @param finding - The Biome finding.
 * @param file - The file the finding points into.
 * @returns Whether the finding is reported.
 */
function reported(finding: BiomeFinding, file: File): boolean {
  if (finding.severity === "hint" || finding.severity === "information") {
    return false;
  }
  return (
    finding.line === undefined ||
    !vibator.ignore.line(file, finding.line, RULE_ID)
  );
}

/**
 * Lints one file and maps its findings to diagnostics.
 *
 * @param file - The file to lint.
 * @param options - The namespace options.
 * @returns The diagnostics for the file.
 */
function fileDiagnostics(file: File, options: BiomeOptions): Diagnostic[] {
  let findings: BiomeFinding[];
  try {
    findings = vibator.biome.lint(file, options);
  } catch (error) {
    return [processError(file, error)];
  }
  return findings
    .filter((finding) => reported(finding, file))
    .map((finding) => toDiagnostic(finding, file));
}

export default defineRule({
  id: RULE_ID,
  title: "Biome reports no issues",
  docs: "@vibator/biome:docs/rules/biome.md",
  options,
  check({ include, exclude, configPath, config }) {
    const biomeOptions: BiomeOptions = {
      configPath,
      config: config as BiomeOptions["config"],
    };
    try {
      vibator.biome.configFile(biomeOptions);
    } catch (error) {
      return configurationReport(error);
    }
    const globs = [...include, ...exclude.map((glob) => `!${glob}`)];
    const diagnostics: Diagnostic[] = [];
    vibator.project.files.match(globs).forEach((file) => {
      if (vibator.ignore.file(file, RULE_ID)) return;
      diagnostics.push(...fileDiagnostics(file, biomeOptions));
    });
    return { diagnostics };
  },
  fix({ configPath, config }, report) {
    const biomeOptions: BiomeOptions = {
      configPath,
      config: config as BiomeOptions["config"],
    };
    const paths = new Set(
      report.diagnostics
        .map((diagnostic) => diagnostic.file)
        .filter((path): path is string => path !== undefined),
    );
    for (const path of paths) {
      const file = vibator.project.files.get(path);
      const fixed = vibator.biome.fix(file, biomeOptions);
      if (fixed !== file.content) vibator.project.write(path, fixed);
    }
  },
});
