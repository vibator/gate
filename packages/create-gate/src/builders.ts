/**
 * The per-step plan builders: each adds one step's work to a plan, given
 * the answers resolved so far.
 *
 * @packageDocumentation
 */
import {
  agentsSection,
  BIOME_HOOK_LINE,
  biomeConfig,
  COMMITLINT_HOOK_LINE,
  commitlintConfig,
  depcruiseConfig,
  qualityWorkflow,
  VIBATOR_HOOK_LINE,
  vibatorConfig,
} from "./content.ts";
import type {
  Answers,
  ConfigAction,
  FollowUp,
  Plan,
  Snapshot,
  StepKey,
} from "./plan.ts";
import { GATE_PACKAGE } from "./plan.ts";

/**
 * Offers to replace an npm script the apply step will refuse to overwrite.
 *
 * @param plan - The plan under construction.
 * @param snapshot - What detection found.
 * @param name - The script name.
 * @param command - The command the gate wants.
 * @param reason - Why replacing it is worth it.
 */
function planScript(
  plan: Plan,
  snapshot: Snapshot,
  name: string,
  command: string,
  reason: string,
): void {
  plan.scripts[name] = command;
  const existing = snapshot.scripts[name];
  if (existing !== undefined && existing !== command) {
    plan.followUps.push({ kind: "replace-script", reason, name, command });
  }
}

/**
 * Adds the lint decision to the plan.
 *
 * @param plan - The plan under construction.
 * @param snapshot - What detection found.
 * @param answers - The resolved choices.
 */
function planLint(plan: Plan, snapshot: Snapshot, answers: Answers): void {
  if (answers.lint === "create" && !snapshot.configs.biome) {
    plan.creations.push({ path: "biome.json", contents: biomeConfig() });
  }
  if (answers.lint === "extend" && snapshot.configs.biome) {
    plan.changes.push({
      kind: "prepend-extends",
      path: snapshot.configs.biome,
      specifier: `${GATE_PACKAGE}/biome`,
    });
  }
  if (answers.lint !== "skip") plan.installs.push("@biomejs/biome");
  const followUp = lintFollowUp(snapshot, answers.lint);
  if (followUp) plan.followUps.push(followUp);
}

/**
 * The migration offered when Biome was adopted next to another linter.
 * Skipping Biome is an answered question and offers nothing: the wizard
 * does not lobby against it.
 *
 * @param snapshot - What detection found.
 * @param lint - The resolved Biome action.
 * @returns The follow-up, or nothing when it does not apply.
 */
function lintFollowUp(
  snapshot: Snapshot,
  lint: ConfigAction,
): FollowUp | undefined {
  const present = snapshot.configs.prettier ?? snapshot.configs.eslint;
  if (!present || lint === "skip") return undefined;
  const subcommand = snapshot.configs.prettier ? "prettier" : "eslint";
  return {
    kind: "command",
    reason: `${present} is still in place; Biome can import its settings, then remove it once Biome owns formatting.`,
    command: `npx biome migrate ${subcommand} --write`,
  };
}

/**
 * Adds the knip decision to the plan.
 *
 * @param plan - The plan under construction.
 * @param _snapshot - Unused; every builder shares one shape.
 * @param answers - The resolved choices.
 */
function planKnip(plan: Plan, _snapshot: Snapshot, answers: Answers): void {
  if (answers.knip) plan.installs.push("knip");
}

/**
 * Adds the dependency-cruiser decision to the plan.
 *
 * @remarks A JSON config gains an extends entry; a JS config is code the
 * wizard must not rewrite, so the exact line to add becomes a note.
 * @param plan - The plan under construction.
 * @param snapshot - What detection found.
 * @param answers - The resolved choices.
 */
function planDepcruise(plan: Plan, snapshot: Snapshot, answers: Answers): void {
  if (!answers.depcruise) return;
  plan.installs.push("dependency-cruiser");
  const existing = snapshot.configs.depcruise;
  if (!existing) {
    plan.creations.push({
      path: ".dependency-cruiser.cjs",
      contents: depcruiseConfig(snapshot.usesTypeScript),
    });
    return;
  }
  if (existing.endsWith(".json")) {
    plan.changes.push({
      kind: "prepend-extends",
      path: existing,
      specifier: `${GATE_PACKAGE}/depcruise`,
    });
    return;
  }
  plan.notes.push(
    `${existing} is code, so it was not edited; add extends: "${GATE_PACKAGE}/depcruise" to it yourself (rules merge by name).`,
  );
}

/**
 * Adds the tsconfig decision to the plan.
 *
 * @param plan - The plan under construction.
 * @param snapshot - What detection found.
 * @param answers - The resolved choices.
 */
function planTsconfig(plan: Plan, snapshot: Snapshot, answers: Answers): void {
  if (!answers.tsconfig || !snapshot.usesTypeScript) return;
  if (snapshot.tsconfigExtendable && snapshot.configs.tsconfig) {
    plan.changes.push({
      kind: "tsconfig-extends",
      path: snapshot.configs.tsconfig,
      specifier: `${GATE_PACKAGE}/tsconfig`,
    });
    return;
  }
  plan.notes.push(
    `tsconfig.json was not edited (it has comments or already extends something). Add "extends": "${GATE_PACKAGE}/tsconfig" yourself; TypeScript 5 accepts an array.`,
  );
}

/**
 * Adds the vibator decision to the plan.
 *
 * @param plan - The plan under construction.
 * @param snapshot - What detection found.
 * @param answers - The resolved choices.
 */
function planVibator(plan: Plan, snapshot: Snapshot, answers: Answers): void {
  if (answers.vibator === "create" && !snapshot.configs.vibator) {
    plan.creations.push({
      path: "vibator.json",
      contents: vibatorConfig(snapshot.usesTypeScript),
    });
  }
  if (answers.vibator === "extend" && snapshot.configs.vibator) {
    plan.changes.push({
      kind: "prepend-extends",
      path: snapshot.configs.vibator,
      specifier: `${GATE_PACKAGE}/vibator`,
    });
  }
  if (answers.vibator !== "skip") plan.installs.push("vibator");
}

/**
 * The hook lines the selected tools need in pre-commit.
 *
 * @param answers - The resolved choices.
 * @returns The lines, fast checks only.
 */
function preCommitLines(answers: Answers): string[] {
  const lines: string[] = [];
  if (answers.lint !== "skip") lines.push(BIOME_HOOK_LINE);
  if (answers.vibator !== "skip") lines.push(VIBATOR_HOOK_LINE);
  return lines;
}

/**
 * Adds the git hook decision to the plan.
 *
 * @param plan - The plan under construction.
 * @param snapshot - What detection found.
 * @param answers - The resolved choices.
 */
function planHooks(plan: Plan, snapshot: Snapshot, answers: Answers): void {
  if (!answers.hooks) return;
  const lines = preCommitLines(answers);
  if (snapshot.hooks.lefthook || snapshot.hooks.simpleGitHooks) {
    plan.notes.push(
      `A hook manager other than husky is in place; add these commands to its pre-commit stage yourself: ${lines.join(" | ")}`,
    );
    return;
  }
  plan.changes.push({ kind: "append-lines", path: ".husky/pre-commit", lines });
  if (answers.commitlint) {
    plan.changes.push({
      kind: "append-lines",
      path: ".husky/commit-msg",
      lines: [COMMITLINT_HOOK_LINE],
    });
  }
  planScript(
    plan,
    snapshot,
    "prepare",
    "husky",
    "husky only activates through the prepare script.",
  );
  plan.installs.push("husky");
}

/**
 * Adds the commitlint decision to the plan.
 *
 * @param plan - The plan under construction.
 * @param snapshot - What detection found.
 * @param answers - The resolved choices.
 */
function planCommitlint(
  plan: Plan,
  snapshot: Snapshot,
  answers: Answers,
): void {
  if (!answers.commitlint || snapshot.configs.commitlint) return;
  plan.creations.push({
    path: ".commitlintrc.json",
    contents: commitlintConfig(),
  });
  plan.installs.push("@commitlint/cli", "@commitlint/config-conventional");
}

/**
 * Adds the CI decision to the plan.
 *
 * @param plan - The plan under construction.
 * @param snapshot - What detection found.
 * @param answers - The resolved choices.
 */
function planCi(plan: Plan, snapshot: Snapshot, answers: Answers): void {
  if (!answers.ci || snapshot.hasQualityWorkflow) return;
  plan.creations.push({
    path: ".github/workflows/quality.yml",
    contents: qualityWorkflow(snapshot.packageManager),
  });
}

/**
 * The `verify` script chaining the selected tools.
 *
 * @param snapshot - What detection found.
 * @param answers - The resolved choices.
 * @returns The chain, in cheapest-first order.
 */
function verifyScript(snapshot: Snapshot, answers: Answers): string {
  const target = snapshot.hasSourceDirectory ? "src" : ".";
  const depcruisePath = snapshot.configs.depcruise ?? ".dependency-cruiser.cjs";
  const parts = [
    answers.lint !== "skip" ? "biome check" : "",
    answers.knip ? "knip" : "",
    answers.depcruise || snapshot.configs.depcruise
      ? `depcruise ${target} --config ${depcruisePath}`
      : "",
    answers.vibator !== "skip" ? "vibator" : "",
  ];
  return parts.filter((part) => part.length > 0).join(" && ");
}

/**
 * Adds the npm scripts and the gate dependency to the plan.
 *
 * @param plan - The plan under construction.
 * @param snapshot - What detection found.
 * @param answers - The resolved choices.
 */
function planScripts(plan: Plan, snapshot: Snapshot, answers: Answers): void {
  const verify = verifyScript(snapshot, answers);
  if (verify.length > 0) {
    planScript(
      plan,
      snapshot,
      "verify",
      verify,
      'the "verify" script is how humans, hooks and CI run the whole gate.',
    );
  }
  if (answers.lint !== "skip") {
    planScript(
      plan,
      snapshot,
      "format",
      "biome format --write",
      "Biome owns formatting once adopted.",
    );
  }
  plan.installs.push(GATE_PACKAGE);
}

/**
 * Adds the agent guidance decision to the plan.
 *
 * @param plan - The plan under construction.
 * @param snapshot - What detection found.
 * @param answers - The resolved choices.
 */
function planAgents(plan: Plan, snapshot: Snapshot, answers: Answers): void {
  if (!answers.agents) return;
  plan.changes.push({
    kind: "append-lines",
    path: snapshot.agentsFile ?? "AGENTS.md",
    lines: agentsSection(snapshot.packageManager, answers.vibator !== "skip"),
    guard: "## Vibator",
  });
}

/** One plan builder per step. */
export const STEP_BUILDERS: Record<
  StepKey,
  (plan: Plan, snapshot: Snapshot, answers: Answers) => void
> = {
  lint: planLint,
  knip: planKnip,
  depcruise: planDepcruise,
  tsconfig: planTsconfig,
  vibator: planVibator,
  hooks: planHooks,
  commitlint: planCommitlint,
  ci: planCi,
  scripts: planScripts,
  agents: planAgents,
};
