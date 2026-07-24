/**
 * Executes a plan. Creations never overwrite, changes are surgical and
 * idempotent, and anything that cannot be done safely becomes a note
 * instead of a surprise.
 *
 * @packageDocumentation
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { withAppendedLines, withExtendsEntry } from "./edits.ts";
import type { FileChange, FollowUp, PackageManager, Plan } from "./plan.ts";

/** What happened when the plan ran. */
export interface ApplyReport {
  /** Actions performed, one line each. */
  performed: string[];
  /** Things already in place; nothing was done, nothing is left to do. */
  unchanged: string[];
  /** Things left for the user, with the reason. */
  notes: string[];
}

/** The install subcommand per package manager. */
const INSTALL_ARGUMENTS: Record<PackageManager, string[]> = {
  npm: ["install", "--save-dev"],
  pnpm: ["add", "--save-dev"],
  yarn: ["add", "--dev"],
  bun: ["add", "--dev"],
};

/**
 * Writes the planned new files, skipping any that already exist.
 *
 * @param root - Absolute repository root.
 * @param plan - The plan being executed.
 * @param report - Where outcomes accumulate.
 */
function writeCreations(root: string, plan: Plan, report: ApplyReport): void {
  for (const creation of plan.creations) {
    const target = join(root, creation.path);
    if (existsSync(target)) {
      report.unchanged.push(`${creation.path} already exists; left untouched.`);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, creation.contents);
    report.performed.push(`created ${creation.path}`);
  }
}

/**
 * Adds an extends entry to a JSON configuration.
 *
 * @param root - Absolute repository root.
 * @param change - The change to apply.
 * @param report - Where outcomes accumulate.
 */
function applyExtends(
  root: string,
  change: FileChange,
  report: ApplyReport,
): void {
  const target = join(root, change.path);
  const specifier = change.specifier ?? "";
  const edited = withExtendsEntry(
    readFileSync(target, "utf8"),
    specifier,
    change.kind,
  );
  if (edited.outcome === "already-extends") {
    report.unchanged.push(`${change.path} already extends ${specifier}.`);
    return;
  }
  if (edited.outcome === "not-json") {
    report.notes.push(
      `${change.path} is not plain JSON; add "extends": "${specifier}" yourself.`,
    );
    return;
  }
  writeFileSync(target, edited.contents);
  report.performed.push(`pointed ${change.path} at ${specifier}`);
}

/**
 * Appends the lines a file is missing, creating the file when absent.
 *
 * @param root - Absolute repository root.
 * @param change - The change to apply.
 * @param report - Where outcomes accumulate.
 */
function appendLines(
  root: string,
  change: FileChange,
  report: ApplyReport,
): void {
  const target = join(root, change.path);
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (change.guard && current.includes(change.guard)) {
    report.unchanged.push(
      `${change.path} already has a "${change.guard}" section; left as is.`,
    );
    return;
  }
  const appended = withAppendedLines(current, change.lines ?? []);
  if (appended.contents === undefined) {
    report.unchanged.push(`${change.path} already has the gate's lines.`);
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, appended.contents);
  report.performed.push(
    `added ${appended.missing.length} line(s) to ${change.path}`,
  );
}

/**
 * Adds the planned npm scripts, never replacing an existing one.
 *
 * @param root - Absolute repository root.
 * @param plan - The plan being executed.
 * @param report - Where outcomes accumulate.
 */
function addScripts(root: string, plan: Plan, report: ApplyReport): void {
  if (Object.keys(plan.scripts).length === 0) return;
  const manifestPath = join(root, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  manifest.scripts = manifest.scripts ?? {};
  const declared = manifest.scripts;
  Object.entries(plan.scripts).forEach(([name, command]) => {
    if (declared[name] === undefined) {
      declared[name] = command;
      report.performed.push(`added script "${name}"`);
    }
  });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Installs the planned devDependencies with the detected package manager.
 *
 * @param root - Absolute repository root.
 * @param plan - The plan being executed.
 * @param report - Where outcomes accumulate.
 */
function installPackages(root: string, plan: Plan, report: ApplyReport): void {
  if (plan.installs.length === 0) return;
  const finished = spawnSync(
    plan.packageManager,
    [...INSTALL_ARGUMENTS[plan.packageManager], ...plan.installs],
    { cwd: root, stdio: "inherit" },
  );
  if (finished.status === 0) {
    report.performed.push(
      `installed ${plan.installs.join(", ")} with ${plan.packageManager}`,
    );
  } else {
    report.notes.push(
      `install failed; run: ${plan.packageManager} ${INSTALL_ARGUMENTS[plan.packageManager].join(" ")} ${plan.installs.join(" ")}`,
    );
  }
}

/**
 * Overwrites one npm script, the consented counterpart of addScripts.
 *
 * @param root - Absolute repository root.
 * @param name - The script name.
 * @param command - The command it becomes.
 */
function replaceScript(root: string, name: string, command: string): void {
  const manifestPath = join(root, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  manifest.scripts = { ...manifest.scripts, [name]: command };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Executes one consented follow-up.
 *
 * @param root - Absolute repository root.
 * @param followUp - The follow-up to execute.
 * @param report - Where outcomes accumulate.
 */
function runFollowUp(
  root: string,
  followUp: FollowUp,
  report: ApplyReport,
): void {
  if (followUp.kind === "replace-script") {
    replaceScript(root, followUp.name, followUp.command);
    report.performed.push(
      `replaced script "${followUp.name}" with: ${followUp.command}`,
    );
    return;
  }
  const finished = spawnSync(followUp.command, {
    cwd: root,
    shell: true,
    stdio: "inherit",
  });
  if (finished.status === 0) {
    report.performed.push(`ran ${followUp.command}`);
  } else {
    report.notes.push(`follow-up failed; run it yourself: ${followUp.command}`);
  }
}

/**
 * Executes the consented follow-ups, each reported individually.
 *
 * @param root - Absolute repository root.
 * @param followUps - The follow-ups the user agreed to.
 * @returns What ran and what failed.
 */
export function runFollowUps(root: string, followUps: FollowUp[]): ApplyReport {
  const report: ApplyReport = { performed: [], unchanged: [], notes: [] };
  followUps.forEach((followUp) => {
    runFollowUp(root, followUp, report);
  });
  return report;
}

/**
 * Reformats the JSON files this run wrote or edited with the repository's
 * own Biome, so the gate's format check passes on the wizard's output.
 *
 * @param root - Absolute repository root.
 * @param plan - The plan that ran.
 */
function formatWrittenFiles(root: string, plan: Plan): void {
  const touched = [
    ...plan.creations.map((creation) => creation.path),
    ...plan.changes.map((change) => change.path),
  ].filter((path) => path.endsWith(".json"));
  if (touched.length === 0) return;
  try {
    const resolver = createRequire(join(root, "package.json"));
    resolver.resolve("@biomejs/biome/package.json");
  } catch {
    return;
  }
  spawnSync("npx", ["biome", "format", "--write", ...touched], {
    cwd: root,
    stdio: "ignore",
  });
}

/**
 * Executes the plan against the repository.
 *
 * @param root - Absolute repository root.
 * @param plan - The plan to execute.
 * @param skipInstall - Whether to leave package installs to the user.
 * @returns What was done and what was left, for the closing summary.
 */
export function applyPlan(
  root: string,
  plan: Plan,
  skipInstall: boolean,
): ApplyReport {
  const report: ApplyReport = {
    performed: [],
    unchanged: [],
    notes: [...plan.notes],
  };
  writeCreations(root, plan, report);
  plan.changes.forEach((change) => {
    if (change.kind === "append-lines") appendLines(root, change, report);
    else applyExtends(root, change, report);
  });
  addScripts(root, plan, report);
  if (skipInstall && plan.installs.length > 0) {
    report.notes.push(
      `installs skipped; run: ${plan.packageManager} ${INSTALL_ARGUMENTS[plan.packageManager].join(" ")} ${plan.installs.join(" ")}`,
    );
  } else {
    installPackages(root, plan, report);
  }
  formatWrittenFiles(root, plan);
  return report;
}
