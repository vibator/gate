/**
 * The command line surface. Every prompt has a flag here, so scripts can
 * run the wizard without a terminal.
 *
 * @packageDocumentation
 */
import { parseArgs } from "node:util";
import type { Answers, ConfigAction } from "./plan.ts";

/** What the command line asked for. */
export interface CliRequest {
  /** Print usage and exit. */
  help: boolean;
  /** Print the version and exit. */
  version: boolean;
  /** Accept every recommendation without prompting. */
  defaults: boolean;
  /** Print the plan as JSON and change nothing. */
  dryRun: boolean;
  /** Write files but run no package installs. */
  skipInstall: boolean;
  /** Whether to run offered migration commands; unset means ask. */
  migrations?: boolean;
  /** Target directory; the current one when omitted. */
  dir?: string;
  /** Choices already made on the command line. */
  answers: Partial<Answers>;
}

/** The value sets each choice flag accepts. */
const CHOICE_VALUES: Record<string, string[]> = {
  lint: ["create", "extend", "skip"],
  vibator: ["create", "extend", "skip"],
  knip: ["yes", "skip"],
  depcruise: ["yes", "skip"],
  tsconfig: ["yes", "skip"],
  hooks: ["yes", "skip"],
  commitlint: ["yes", "skip"],
  ci: ["yes", "skip"],
  agents: ["yes", "skip"],
  migrations: ["yes", "skip"],
};

/**
 * Validates one choice flag's value.
 *
 * @param flag - The flag name.
 * @param value - The raw value, when the flag was given.
 * @returns The value, checked against the flag's accepted set.
 */
function checkedChoice(
  flag: string,
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  const accepted = CHOICE_VALUES[flag] ?? [];
  if (!accepted.includes(value)) {
    throw new Error(
      `--${flag} accepts ${accepted.join(", ")}; got "${value}".`,
    );
  }
  return value;
}

/**
 * Converts the validated choice flags into partial answers.
 *
 * @param values - The raw flag values from `parseArgs`.
 * @returns Only the answers the command line stated.
 */
function answersFromFlags(values: Record<string, unknown>): Partial<Answers> {
  const answers: Partial<Answers> = {};
  const lint = checkedChoice("lint", values.lint as string | undefined);
  if (lint) answers.lint = lint as ConfigAction;
  const vibator = checkedChoice(
    "vibator",
    values.vibator as string | undefined,
  );
  if (vibator) answers.vibator = vibator as ConfigAction;
  for (const flag of [
    "knip",
    "depcruise",
    "tsconfig",
    "hooks",
    "commitlint",
    "ci",
    "agents",
  ] as const) {
    const value = checkedChoice(flag, values[flag] as string | undefined);
    if (value) answers[flag] = value === "yes";
  }
  return answers;
}

/** The flag table `parseArgs` runs with. */
const FLAG_TABLE = {
  help: { type: "boolean", default: false },
  version: { type: "boolean", default: false },
  defaults: { type: "boolean", default: false },
  yes: { type: "boolean", default: false },
  "dry-run": { type: "boolean", default: false },
  "skip-install": { type: "boolean", default: false },
  dir: { type: "string" },
  lint: { type: "string" },
  vibator: { type: "string" },
  knip: { type: "string" },
  depcruise: { type: "string" },
  tsconfig: { type: "string" },
  hooks: { type: "string" },
  commitlint: { type: "string" },
  ci: { type: "string" },
  agents: { type: "string" },
  migrations: { type: "string" },
} as const;

/**
 * Parses the command line.
 *
 * @param argv - Arguments after the script name.
 * @returns The request, with flag-stated answers separated out.
 */
export function parseCli(argv: string[]): CliRequest {
  const { values } = parseArgs({
    args: argv,
    options: FLAG_TABLE,
    strict: true,
  });
  const migrations = checkedChoice("migrations", values.migrations);
  return {
    help: values.help,
    version: values.version,
    defaults: values.defaults || values.yes,
    dryRun: values["dry-run"],
    skipInstall: values["skip-install"],
    migrations: migrations === undefined ? undefined : migrations === "yes",
    dir: values.dir,
    answers: answersFromFlags(values),
  };
}

/**
 * The flags-only command line reproducing a set of answers.
 *
 * @param answers - The resolved choices.
 * @returns A command a script or an agent can run to repeat them.
 */
export function reproduceCommand(answers: Answers): string {
  const yesOrSkip = (chosen: boolean): string => (chosen ? "yes" : "skip");
  return [
    "npx @vibator/create-gate",
    `--lint=${answers.lint}`,
    `--vibator=${answers.vibator}`,
    `--knip=${yesOrSkip(answers.knip)}`,
    `--depcruise=${yesOrSkip(answers.depcruise)}`,
    `--tsconfig=${yesOrSkip(answers.tsconfig)}`,
    `--hooks=${yesOrSkip(answers.hooks)}`,
    `--commitlint=${yesOrSkip(answers.commitlint)}`,
    `--ci=${yesOrSkip(answers.ci)}`,
    `--agents=${yesOrSkip(answers.agents)}`,
  ].join(" ");
}
