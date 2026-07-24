/**
 * Follow-up handling for the step wizard: what can run now, how it is
 * shown, and the consent that runs it.
 *
 * @packageDocumentation
 */
import * as clack from "@clack/prompts";
import type { ApplyReport } from "./apply.ts";
import { runFollowUps } from "./apply.ts";
import type { CliRequest } from "./arguments.ts";
import type { FollowUp, Plan } from "./plan.ts";
import { boxedContent } from "./preview.ts";

/**
 * Folds one report into another.
 *
 * @param target - The run's report, extended in place.
 * @param extra - The outcome to fold in.
 */
export function mergeReport(target: ApplyReport, extra: ApplyReport): void {
  target.performed.push(...extra.performed);
  target.unchanged.push(...extra.unchanged);
  target.notes.push(...extra.notes);
}

/**
 * The follow-ups that can run right now: without installs, commands have
 * nothing to execute with, but script replacements still work.
 *
 * @param followUps - The step's follow-ups.
 * @param skipInstall - Whether installs were skipped.
 * @returns The runnable follow-ups.
 */
function runnableFollowUps(
  followUps: FollowUp[],
  skipInstall: boolean,
): FollowUp[] {
  if (!skipInstall) return followUps;
  return followUps.filter((followUp) => followUp.kind === "replace-script");
}

/**
 * One follow-up as a display line.
 *
 * @param followUp - The follow-up.
 * @returns The line.
 */
function followUpLine(followUp: FollowUp): string {
  return followUp.kind === "command"
    ? `${followUp.command}\n  ${followUp.reason}`
    : `replace script "${followUp.name}" with: ${followUp.command}\n  ${followUp.reason}`;
}

/**
 * Offers and runs a step's follow-ups, folding outcomes into the report.
 *
 * @param root - Absolute repository root.
 * @param plan - The step's plan.
 * @param request - What the command line asked for.
 * @param report - The run's report.
 * @returns Whether the user cancelled.
 */
export async function settleStepFollowUps(
  root: string,
  plan: Plan,
  request: CliRequest,
  report: ApplyReport,
): Promise<boolean> {
  const runnable = runnableFollowUps(plan.followUps, request.skipInstall);
  const declined = plan.followUps.filter((entry) => !runnable.includes(entry));
  let consented = request.migrations ?? undefined;
  if (runnable.length > 0 && consented === undefined) {
    clack.note(
      boxedContent(runnable.map(followUpLine).join("\n")),
      "Follow-ups",
    );
    const choice = await clack.confirm({
      message: "Apply these follow-ups?",
      initialValue: true,
    });
    if (clack.isCancel(choice)) return true;
    consented = choice;
  }
  if (consented && runnable.length > 0) {
    mergeReport(report, runFollowUps(root, runnable));
  } else {
    declined.push(...runnable.filter(() => !consented));
  }
  declined.forEach((entry) => {
    report.notes.push(
      `${entry.reason} Offered: ${followUpLine(entry).split("\n")[0]}`,
    );
  });
  return false;
}
