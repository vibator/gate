/**
 * The interactive flow: one numbered box per step with the aim, the exact
 * changes and the warnings inside, applied immediately on yes, follow-ups
 * offered right after. Terminal-less runs never come here.
 *
 * @packageDocumentation
 */
import { styleText } from "node:util";
import * as clack from "@clack/prompts";
import type { ApplyReport } from "./apply.ts";
import { applyPlan } from "./apply.ts";
import type { CliRequest } from "./arguments.ts";
import { reproduceCommand } from "./arguments.ts";
import { buildStepPlan, recommend } from "./decide.ts";
import { mergeReport, settleStepFollowUps } from "./follow-ups.ts";
import type { Answers, ConfigAction, Plan, Snapshot } from "./plan.ts";
import { boxedContent, planPreview } from "./preview.ts";
import type { WizardStep } from "./steps.ts";
import { wizardSteps } from "./steps.ts";

/** What one step run leaves behind. */
interface StepOutcome {
  /** Whether the user cancelled the whole run. */
  cancelled: boolean;
}

/**
 * Shows one step's box: aim first, then exactly what would change.
 *
 * @param root - Absolute repository root.
 * @param step - The step being shown.
 * @param plan - The step's plan.
 * @param position - The step's number and the total, for the title.
 */
function showStepBox(
  root: string,
  step: WizardStep,
  plan: Plan,
  position: string,
): void {
  const preview = planPreview(root, plan);
  const body = preview.length > 0 ? `${step.aim}\n\n${preview}` : step.aim;
  clack.note(boxedContent(body), `${position} · ${step.title}`);
}

/**
 * Asks a create/extend/skip step for its action.
 *
 * @param step - The step being asked.
 * @param snapshot - What detection found.
 * @param recommended - The recommendation to preselect.
 * @returns The action, or `undefined` on cancel.
 */
async function askAction(
  step: WizardStep,
  snapshot: Snapshot,
  recommended: ConfigAction,
): Promise<ConfigAction | undefined> {
  const existing =
    step.key === "lint" ? snapshot.configs.biome : snapshot.configs.vibator;
  const adopt: { value: ConfigAction; label: string } = existing
    ? { value: "extend", label: `Extend the existing ${existing}` }
    : { value: "create", label: `Create a thin config extending the gate` };
  const choice = await clack.select({
    message: `${step.title}: what should happen?`,
    options: [adopt, { value: "skip", label: `Leave ${step.title} out` }],
    initialValue:
      recommended === "skip" ? ("skip" as ConfigAction) : adopt.value,
  });
  return clack.isCancel(choice) ? undefined : choice;
}

/**
 * Resolves one step's answer from flags or by asking.
 *
 * @param step - The step being resolved.
 * @param context - The run's shared state.
 * @returns The answer value, or `undefined` on cancel.
 */
async function stepAnswer(
  step: WizardStep,
  context: StepContext,
): Promise<Answers[keyof Answers] | undefined> {
  if (step.key === "scripts") return true;
  const key = step.key as keyof Answers;
  const given = context.request.answers[key];
  if (given !== undefined) return given;
  if (step.ask === "action") {
    return askAction(
      step,
      context.snapshot,
      context.recommended[key] as ConfigAction,
    );
  }
  return context.recommended[key];
}

/**
 * Stores a resolved answer; the scripts step has no answer to store.
 *
 * @param answers - The run's answers, updated in place.
 * @param step - The step that was answered.
 * @param value - The resolved answer.
 */
function recordAnswer(
  answers: Answers,
  step: WizardStep,
  value: Answers[keyof Answers],
): void {
  if (step.key === "scripts") return;
  (answers[step.key as keyof Answers] as Answers[keyof Answers]) = value;
}

/**
 * Whether an answer means the step does anything.
 *
 * @param value - The resolved answer.
 * @returns `true` when the step is active.
 */
function isActive(value: Answers[keyof Answers]): boolean {
  return value !== false && value !== "skip";
}

/** The run's shared state, threaded through every step. */
interface StepContext {
  /** What detection found. */
  snapshot: Snapshot;
  /** What the command line asked for. */
  request: CliRequest;
  /** The recommendations. */
  recommended: Answers;
  /** The answers resolved so far, updated in place. */
  answers: Answers;
  /** The run's report, extended in place. */
  report: ApplyReport;
}

/**
 * Records a skip and tells the user, one settled line.
 *
 * @param context - The run's shared state.
 * @param step - The step being skipped.
 * @param position - The step's number and the total.
 * @param value - The answer to record.
 * @returns A non-cancelling outcome.
 */
function skipStep(
  context: StepContext,
  step: WizardStep,
  position: string,
  value: Answers[keyof Answers],
): StepOutcome {
  recordAnswer(context.answers, step, value);
  clack.log.step(`${position} \u00b7 ${step.title}: skipped`);
  return { cancelled: false };
}

/**
 * Confirms one step after its box, honouring flag-stated answers.
 *
 * @param step - The step being confirmed.
 * @param context - The run's shared state.
 * @returns Apply, skip, or cancel.
 */
async function confirmStepApply(
  step: WizardStep,
  context: StepContext,
): Promise<"apply" | "skip" | "cancel"> {
  const flagged =
    step.key !== "scripts" &&
    context.request.answers[step.key as keyof Answers] !== undefined;
  if (step.ask === "auto" || flagged) return "apply";
  const apply = await clack.confirm({
    message: "Apply this step?",
    initialValue:
      step.ask === "action"
        ? true
        : (context.recommended[step.key as keyof Answers] as boolean),
  });
  if (clack.isCancel(apply)) return "cancel";
  return apply ? "apply" : "skip";
}

/**
 * Runs one step: box, question, apply, follow-ups.
 *
 * @param root - Absolute repository root.
 * @param step - The step to run.
 * @param position - The step's number and the total.
 * @param context - The run's shared state.
 * @returns Whether the user cancelled.
 */
async function runStep(
  root: string,
  step: WizardStep,
  position: string,
  context: StepContext,
): Promise<StepOutcome> {
  const answer = await stepAnswer(step, context);
  if (answer === undefined) return { cancelled: true };
  recordAnswer(context.answers, step, answer);
  if (!isActive(answer)) return skipStep(context, step, position, answer);
  const plan = buildStepPlan(step.key, context.snapshot, context.answers);
  showStepBox(root, step, plan, position);
  const decision = await confirmStepApply(step, context);
  if (decision === "cancel") return { cancelled: true };
  if (decision === "skip") {
    return skipStep(
      context,
      step,
      position,
      step.ask === "action" ? "skip" : false,
    );
  }
  return applyStep(root, plan, context);
}

/**
 * Applies a step's plan and settles its follow-ups.
 *
 * @param root - Absolute repository root.
 * @param plan - The step's plan.
 * @param context - The run's shared state.
 * @returns Whether the user cancelled during the follow-ups.
 */
async function applyStep(
  root: string,
  plan: Plan,
  context: StepContext,
): Promise<StepOutcome> {
  mergeReport(
    context.report,
    applyPlan(root, plan, context.request.skipInstall),
  );
  const cancelled = await settleStepFollowUps(
    root,
    plan,
    context.request,
    context.report,
  );
  return { cancelled };
}

/**
 * Prints the closing summary.
 *
 * @param report - Everything the run did and left.
 * @param answers - The resolved choices, for the reproduce line.
 * @param packageManager - The manager named in the next step.
 */
function printSummary(
  report: ApplyReport,
  answers: Answers,
  packageManager: string,
): void {
  const paint = (
    style: Parameters<typeof styleText>[0],
    text: string,
  ): string =>
    process.env.NO_COLOR
      ? text
      : styleText(style, text, { validateStream: false });
  report.performed.forEach((line) => {
    console.log(`  ${paint("green", "✔")} ${line}`);
  });
  report.unchanged.forEach((line) => {
    console.log(`  ${paint("dim", `· ${line}`)}`);
  });
  report.notes.forEach((note) => {
    console.log(`  ${paint("yellow", `▲ ${note}`)}`);
  });
  console.log(`\nReproduce these choices: ${reproduceCommand(answers)}`);
  console.log(`Next: ${packageManager} run verify`);
}

/**
 * Runs the wizard step by step: each step shows its box, applies on yes,
 * and offers its follow-ups before the next one starts.
 *
 * @param snapshot - What detection found.
 * @param request - What the command line asked for.
 */
export async function runStepWizard(
  snapshot: Snapshot,
  request: CliRequest,
): Promise<void> {
  const steps = wizardSteps(snapshot);
  const recommended = recommend(snapshot);
  const context = {
    snapshot,
    request,
    recommended,
    answers: { ...recommended },
    report: { performed: [], unchanged: [], notes: [] } as ApplyReport,
  };
  clack.intro(`create-gate: ${steps.length} steps`);
  for (const [index, step] of steps.entries()) {
    const outcome = await runStep(
      snapshot.root,
      step,
      `${index + 1}/${steps.length}`,
      context,
    );
    if (outcome.cancelled) {
      clack.cancel("Stopped; everything applied so far is in place.");
      break;
    }
  }
  printSummary(context.report, context.answers, snapshot.packageManager);
}
