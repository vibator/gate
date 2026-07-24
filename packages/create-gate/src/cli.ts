#!/usr/bin/env node
/**
 * Command line entry point for the setup wizard.
 *
 * @packageDocumentation
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { styleText } from "node:util";
import * as clack from "@clack/prompts";
import type { ApplyReport } from "./apply.ts";
import { applyPlan, runFollowUps } from "./apply.ts";
import type { CliRequest } from "./arguments.ts";
import { parseCli, reproduceCommand } from "./arguments.ts";
import { buildPlan, forcedAnswers, recommend } from "./decide.ts";
import { takeSnapshot } from "./detect.ts";
import type { Answers, Plan, Snapshot } from "./plan.ts";
import { paintedPreview, planPreview, wrappedPreview } from "./preview.ts";
import { usage } from "./usage.ts";
import { runStepWizard } from "./wizard.ts";

/** Every decision key, for completeness checks. */
const ANSWER_KEYS: (keyof Answers)[] = [
  "lint",
  "knip",
  "depcruise",
  "vibator",
  "tsconfig",
  "hooks",
  "commitlint",
  "ci",
  "agents",
];

/** Whether this run has a terminal to ask questions in. */
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

/**
 * Reads this package's version from its manifest.
 *
 * @returns The version string.
 */
function packageVersion(): string {
  const manifest = new URL("../package.json", import.meta.url);
  return (JSON.parse(readFileSync(manifest, "utf8")) as { version: string })
    .version;
}

/**
 * The decision keys the given answers leave open.
 *
 * @param partial - The answers so far.
 * @returns The unanswered keys.
 */
function missingKeys(partial: Partial<Answers>): (keyof Answers)[] {
  return ANSWER_KEYS.filter((key) => partial[key] === undefined);
}

/**
 * Resolves every decision from flags, defaults or prompts.
 *
 * @param snapshot - What detection found.
 * @param request - What the command line asked for.
 * @returns The answers, or `undefined` when resolution was impossible.
 */
async function resolveAnswers(
  snapshot: Snapshot,
  request: CliRequest,
): Promise<Answers | undefined> {
  const stated: Partial<Answers> = {
    ...forcedAnswers(snapshot),
    ...request.answers,
  };
  if (request.defaults) return { ...recommend(snapshot), ...stated };
  if (missingKeys(stated).length === 0) return stated as Answers;
  console.error(
    "No terminal to ask questions in. Re-run with --defaults to accept the",
  );
  console.error(
    `recommendations, or state the open flags: ${missingKeys(stated)
      .map((key) => `--${key}`)
      .join(" ")}`,
  );
  process.exitCode = 2;
  return undefined;
}

/**
 * Shows exactly what will change, then asks for confirmation. The preview
 * runs the same transforms the apply step runs, so approving it approves
 * the diff, not a summary of one.
 *
 * @param root - Absolute repository root.
 * @param plan - The plan about to run.
 * @returns Whether to proceed.
 */
async function confirmPlan(root: string, plan: Plan): Promise<boolean> {
  if (!interactive) return true;
  const width = (process.stdout.columns ?? 80) - 8;
  const preview = wrappedPreview(planPreview(root, plan), width);
  clack.note(
    process.env.NO_COLOR ? preview : paintedPreview(preview),
    "What will change",
  );
  const approved = await clack.confirm({
    message: "Apply it?",
    initialValue: true,
  });
  return !clack.isCancel(approved) && approved;
}

/**
 * One follow-up as a single display line.
 *
 * @param followUp - The follow-up.
 * @returns The line.
 */
function followUpLine(followUp: Plan["followUps"][number]): string {
  return followUp.kind === "command"
    ? followUp.command
    : `replace script "${followUp.name}" with: ${followUp.command}`;
}

/**
 * Runs or declines the offered follow-ups, folding the outcome into the
 * report: declined follow-ups stay visible as the change to make yourself.
 *
 * @param root - Absolute repository root.
 * @param plan - The plan that was applied.
 * @param request - What the command line asked for.
 * @param report - The apply report to extend.
 * @returns Whether the follow-ups ran, for the reproduce line.
 */
function settleFollowUps(
  root: string,
  plan: Plan,
  request: CliRequest,
  report: ApplyReport,
): boolean {
  if (plan.followUps.length === 0) return false;
  const consented = request.migrations === true && !request.skipInstall;
  if (consented) {
    const outcome = runFollowUps(root, plan.followUps);
    report.performed.push(...outcome.performed);
    report.notes.push(...outcome.notes);
    return true;
  }
  plan.followUps.forEach((followUp) => {
    report.notes.push(`${followUp.reason} Offered: ${followUpLine(followUp)}`);
  });
  return false;
}

/**
 * Prints what happened and what to do next.
 *
 * @param report - What the apply step did.
 * @param answers - The resolved choices, for the reproduce line.
 * @param packageManager - The manager named in the next step.
 * @param reproduceSuffix - Extra flags reproducing post-apply consents.
 */
function printReport(
  report: ApplyReport,
  answers: Answers,
  packageManager: string,
  reproduceSuffix: string,
): void {
  const paint = (
    style: Parameters<typeof styleText>[0],
    text: string,
  ): string =>
    interactive && !process.env.NO_COLOR
      ? styleText(style, text, { validateStream: false })
      : text;
  report.performed.forEach((line) => {
    console.log(`  ${paint("green", "\u2714")} ${line}`);
  });
  report.unchanged.forEach((line) => {
    console.log(`  ${paint("dim", `\u00b7 ${line}`)}`);
  });
  report.notes.forEach((note) => {
    console.log(`  ${paint("yellow", `\u25b2 ${note}`)}`);
  });
  console.log(
    `\nReproduce these choices: ${reproduceCommand(answers)}${reproduceSuffix}`,
  );
  console.log(`Next: ${packageManager} run verify`);
}

/**
 * Runs the wizard. Safe to repeat: every action skips what is already in
 * place, so a re-run offers the questions again and fixes only the gaps.
 *
 * @param snapshot - What detection found.
 * @param request - What the command line asked for.
 */
async function runWizard(
  snapshot: Snapshot,
  request: CliRequest,
): Promise<void> {
  const answers = await resolveAnswers(snapshot, request);
  if (!answers) return;
  const plan = buildPlan(snapshot, answers);
  if (request.dryRun) {
    console.log(
      JSON.stringify(
        { answers, plan, reproduce: reproduceCommand(answers) },
        null,
        2,
      ),
    );
    return;
  }
  if (!(await confirmPlan(snapshot.root, plan))) return;
  const report = applyPlan(snapshot.root, plan, request.skipInstall);
  const ran = settleFollowUps(snapshot.root, plan, request, report);
  const reproduceSuffix =
    plan.followUps.length > 0 ? ` --migrations=${ran ? "yes" : "skip"}` : "";
  printReport(report, answers, snapshot.packageManager, reproduceSuffix);
}

/**
 * Parses the command line, routing errors to a usage hint.
 *
 * @returns The request, or `undefined` after reporting a bad flag.
 */
function readRequest(): CliRequest | undefined {
  try {
    return parseCli(process.argv.slice(2));
  } catch (failure) {
    console.error(failure instanceof Error ? failure.message : String(failure));
    console.error("Run with --help for the flag list.");
    process.exitCode = 2;
    return undefined;
  }
}

/**
 * Runs the wizard.
 */
async function main(): Promise<void> {
  const request = readRequest();
  if (!request) return;
  if (request.version) {
    console.log(packageVersion());
    return;
  }
  if (request.help) {
    console.log(usage(packageVersion()));
    return;
  }
  const snapshot = takeSnapshot(resolve(request.dir ?? process.cwd()));
  if (!snapshot.hasPackageJson) {
    console.error(
      "No package.json here. Run your package manager's init first, then re-run this wizard.",
    );
    process.exitCode = 1;
    return;
  }
  if (interactive && !request.defaults && !request.dryRun) {
    await runStepWizard(snapshot, request);
    return;
  }
  await runWizard(snapshot, request);
}

await main();
