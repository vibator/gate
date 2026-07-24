/**
 * The wizard's steps: what each one is called, what it is for, how it asks,
 * and when it applies at all.
 *
 * @packageDocumentation
 */
import type { Snapshot, StepKey } from "./plan.ts";
import { STEP_ORDER } from "./plan.ts";

/** How a step asks: a create/extend/skip choice, a yes/no, or not at all. */
type StepAsk = "action" | "confirm" | "auto";

/** One wizard step's presentation. */
export interface WizardStep {
  /** The decision key the step resolves. */
  key: StepKey;
  /** The title shown in the step's box. */
  title: string;
  /** What the tool or piece is for, shown inside the box. */
  aim: string;
  /** How the step asks. */
  ask: StepAsk;
  /**
   * Whether the step exists for this repository at all.
   *
   * @param snapshot - What detection found.
   * @returns `false` to leave the step out of the run and the count.
   */
  applies(snapshot: Snapshot): boolean;
}

/** Every step's presentation, keyed for lookup. */
const STEP_DETAILS: Record<StepKey, Omit<WizardStep, "key">> = {
  lint: {
    title: "Biome",
    aim: "One fast tool for formatting and linting, with complexity and file-length budgets.",
    ask: "action",
    applies: () => true,
  },
  knip: {
    title: "knip",
    aim: "Finds dead files, unused exports and unused dependencies before they accumulate.",
    ask: "confirm",
    applies: () => true,
  },
  depcruise: {
    title: "dependency-cruiser",
    aim: "Keeps the dependency graph sound: no cycles, no unresolvable imports, no undeclared packages.",
    ask: "confirm",
    applies: () => true,
  },
  tsconfig: {
    title: "TypeScript strictness",
    aim: "Strictness flags only; your module, target and paths stay yours.",
    ask: "confirm",
    applies: (snapshot) => snapshot.usesTypeScript,
  },
  vibator: {
    title: "vibator",
    aim: "Catches what the other tools cannot: the standards agents drift from as context grows.",
    ask: "action",
    applies: () => true,
  },
  hooks: {
    title: "Git hooks",
    aim: "Runs the fast checks on staged files, so problems stop before the commit.",
    ask: "confirm",
    applies: () => true,
  },
  commitlint: {
    title: "commitlint",
    aim: "Conventional Commits, so commit types can drive releases and changelogs.",
    ask: "confirm",
    applies: (snapshot) => snapshot.configs.commitlint === undefined,
  },
  ci: {
    title: "CI workflow",
    aim: "Runs the verify script on every push and pull request.",
    ask: "confirm",
    applies: (snapshot) => !snapshot.hasQualityWorkflow,
  },
  scripts: {
    title: "npm scripts",
    aim: "verify runs the whole gate; format applies Biome. Existing scripts are never overwritten here.",
    ask: "auto",
    applies: () => true,
  },
  agents: {
    title: "Agent guidance",
    aim: "Tells coding agents the gate exists, how to run it, and where the skills are.",
    ask: "confirm",
    applies: () => true,
  },
};

/**
 * The steps that exist for a repository, in order.
 *
 * @param snapshot - What detection found.
 * @returns The applicable steps.
 */
export function wizardSteps(snapshot: Snapshot): WizardStep[] {
  return STEP_ORDER.map((key) => ({ key, ...STEP_DETAILS[key] })).filter(
    (step) => step.applies(snapshot),
  );
}
