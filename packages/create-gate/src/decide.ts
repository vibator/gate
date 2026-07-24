/**
 * Turns a snapshot and the resolved answers into a concrete plan, whole or
 * one step at a time. Pure functions: the same snapshot and answers always
 * produce the same plan.
 *
 * @packageDocumentation
 */
import { STEP_BUILDERS } from "./builders.ts";
import type { Answers, ConfigAction, Plan, Snapshot, StepKey } from "./plan.ts";
import { GATE_PACKAGE, STEP_ORDER } from "./plan.ts";

/**
 * The recommended action for Biome.
 *
 * @param snapshot - What detection found.
 * @returns Extend an existing Biome config, respect another linter, or create.
 */
function recommendLint(snapshot: Snapshot): ConfigAction {
  if (snapshot.configs.biome) return "extend";
  if (snapshot.configs.eslint || snapshot.configs.prettier) return "skip";
  return "create";
}

/**
 * The recommendation for every decision point.
 *
 * @param snapshot - What detection found.
 * @returns The answers `--defaults` accepts and prompts start from.
 */
export function recommend(snapshot: Snapshot): Answers {
  return {
    lint: recommendLint(snapshot),
    knip: true,
    depcruise: true,
    vibator: snapshot.configs.vibator ? "extend" : "create",
    tsconfig: snapshot.tsconfigExtendable,
    hooks: true,
    commitlint: snapshot.configs.commitlint === undefined,
    ci: !snapshot.hasQualityWorkflow,
    agents: true,
  };
}

/**
 * The answers the situation fixes on its own, so nobody is asked about
 * choices that do not exist.
 *
 * @param snapshot - What detection found.
 * @returns The decision points that need no question.
 */
export function forcedAnswers(snapshot: Snapshot): Partial<Answers> {
  const forced: Partial<Answers> = {};
  if (!snapshot.usesTypeScript) forced.tsconfig = false;
  if (snapshot.configs.commitlint) forced.commitlint = false;
  if (snapshot.hasQualityWorkflow) forced.ci = false;
  return forced;
}

/**
 * A plan with nothing in it yet.
 *
 * @param snapshot - What detection found, for the package manager.
 * @returns The empty plan.
 */
function emptyPlan(snapshot: Snapshot): Plan {
  return {
    packageManager: snapshot.packageManager,
    installs: [],
    creations: [],
    changes: [],
    scripts: {},
    followUps: [],
    notes: [],
  };
}

/**
 * Settles a plan's installs: the gate rides along with any install, and
 * nothing already present installs again.
 *
 * @param plan - The plan to finalise.
 * @param snapshot - What detection found.
 */
function finaliseInstalls(plan: Plan, snapshot: Snapshot): void {
  if (plan.installs.length > 0) plan.installs.push(GATE_PACKAGE);
  plan.installs = [...new Set(plan.installs)].filter(
    (name) => !snapshot.installedPackages.includes(name),
  );
}

/**
 * Builds the plan fragment for one step, given the answers so far.
 *
 * @param key - The step to build.
 * @param snapshot - What detection found.
 * @param answers - The resolved choices; later steps may consult earlier ones.
 * @returns The step's own plan.
 */
export function buildStepPlan(
  key: StepKey,
  snapshot: Snapshot,
  answers: Answers,
): Plan {
  const plan = emptyPlan(snapshot);
  STEP_BUILDERS[key](plan, snapshot, answers);
  finaliseInstalls(plan, snapshot);
  return plan;
}

/**
 * Builds the full plan from a snapshot and the resolved answers.
 *
 * @param snapshot - What detection found.
 * @param answers - The resolved choices.
 * @returns Everything the wizard intends to do.
 */
export function buildPlan(snapshot: Snapshot, answers: Answers): Plan {
  const plan = emptyPlan(snapshot);
  STEP_ORDER.forEach((key) => {
    STEP_BUILDERS[key](plan, snapshot, answers);
  });
  if (!snapshot.isGitRepository) {
    plan.notes.push(
      "Not a git repository. vibator discovers files through git; run `git init` first for accurate results.",
    );
  }
  finaliseInstalls(plan, snapshot);
  return plan;
}
