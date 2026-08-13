/**
 * The `codegen-drift` rule: generated files match the source they derive
 * from.
 *
 * @packageDocumentation
 */
import { join } from "node:path";
import {
  type Diagnostic,
  defineRule,
  type StatusEntry,
  vibator,
} from "vibator";
import { z } from "zod";

const RULE_ID = "codegen-drift";

/** One configured generator. */
const generatorSchema = z.object({
  /** Human-readable name, used in messages. */
  name: z.string().describe("Human-readable name, used in messages"),
  /** Shell command that regenerates the output. */
  command: z.string().describe("Shell command that regenerates the output"),
  /** Working directory, relative to the project root. */
  cwd: z
    .string()
    .default(".")
    .describe("Working directory, relative to the project root"),
  /** Paths the generator writes, relative to the project root. */
  paths: z
    .array(z.string())
    .min(1)
    .describe("Paths the generator writes, relative to the project root"),
  /** How long to allow before treating the run as stuck. */
  timeoutMs: z
    .number()
    .int()
    .positive()
    .default(180_000)
    .describe("How long to allow before treating the run as stuck, ms"),
});

/** One configured generator. */
type Generator = z.infer<typeof generatorSchema>;

const options = z.object({
  /** Generators to run, each with the paths it owns. */
  generators: z
    .array(generatorSchema)
    .min(1)
    .describe("Generators to run, each with the paths it owns"),
});

/**
 * Explains why the rule will not judge output it did not find clean.
 *
 * @param generator - The generator whose paths are dirty.
 * @returns The refusal diagnostic.
 */
function refusal(generator: Generator): Diagnostic {
  return {
    message: `Refusing to check "${generator.name}": its output has uncommitted changes`,
    expected: "A clean working tree for generated paths",
    fix: `Commit or discard changes under ${generator.paths.join(", ")}, then re-run; this rule reverts what it generates and cannot tell your work from its own`,
  };
}

/**
 * Runs a generator.
 *
 * @param generator - The generator to run.
 * @returns A diagnostic when the command itself failed, otherwise nothing.
 */
function regenerate(generator: Generator): Diagnostic | undefined {
  const result = vibator.shell.run(generator.command, {
    cwd: generator.cwd,
    timeoutMs: generator.timeoutMs,
  });
  if (result.ok) return undefined;
  const detail = (result.stderr || result.stdout).split("\n")[0] ?? "";
  return {
    message: `Generator "${generator.name}" failed: ${generator.command}`,
    expected: "The generator runs cleanly",
    fix: detail === "" ? `The command exited with code ${result.code}` : detail,
  };
}

/**
 * Undoes whatever a generation run wrote.
 *
 * @remarks Safe only because the paths were verified pristine first, so every
 * change present now was made by this rule. Untracked files are deleted and
 * tracked ones restored, both scoped to the generator's own paths.
 * @param entries - The status entries to undo.
 */
function revert(entries: StatusEntry[]): void {
  const untracked = entries
    .filter((entry) => entry.untracked)
    .map((entry) => entry.path);
  if (untracked.length > 0) {
    const quoted = untracked.map((path) => JSON.stringify(path)).join(" ");
    vibator.shell.run(`git clean -f -- ${quoted}`, {});
  }
  const tracked = entries
    .filter((entry) => !entry.untracked)
    .map((entry) => entry.path);
  if (tracked.length > 0) vibator.git.restore(tracked);
}

/**
 * Whether a drifted path becomes a diagnostic: any that no file-level ignore
 * marker silences.
 *
 * @param entry - The status entry of the drifted path.
 * @returns Whether the path is reported.
 */
function reported(entry: StatusEntry): boolean {
  const file = vibator.project.files.get(
    join(vibator.project.root, entry.path),
  );
  try {
    return !vibator.ignore.file(file, RULE_ID);
  } catch {
    return true;
  }
}

/**
 * Runs one generator and reports whether its output had drifted.
 *
 * @param generator - The generator to check.
 * @returns The findings for that generator.
 */
function checkGenerator(generator: Generator): Diagnostic[] {
  const preexisting = vibator.git.status(generator.paths);
  if (preexisting.length > 0) return [refusal(generator)];

  const failure = regenerate(generator);
  if (failure) return [failure];

  const drift = vibator.git.status(generator.paths);
  if (drift.length === 0) return [];

  revert(drift);
  return drift.filter(reported).map((entry) => ({
    file: join(vibator.project.root, entry.path),
    message: `Out of date: regenerating "${generator.name}" changes this file`,
    expected: "Generated output committed alongside the source it derives from",
    fix: `Run \`${generator.command}\` and commit the result`,
  }));
}

export default defineRule({
  id: RULE_ID,
  title: "Generated files match the source they derive from",
  docs: "@vibator/recommended:docs/rules/codegen-drift.md",
  severity: "off",
  options,
  check({ generators }) {
    return { diagnostics: generators.flatMap(checkGenerator) };
  },
});
