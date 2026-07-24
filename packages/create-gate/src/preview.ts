/**
 * Renders what a plan will do, file by file, with diffs for edits. Shown
 * before anything is applied, so approving means approving exactly this.
 *
 * @packageDocumentation
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { styleText } from "node:util";
import { diffLines } from "diff";
import { withAppendedLines, withExtendsEntry } from "./edits.ts";
import type { FileChange, Plan } from "./plan.ts";

/**
 * The marker for one diff chunk.
 *
 * @param part - A change object from the diff.
 * @returns The two-character line prefix.
 */
function prefixOf(part: { added?: boolean; removed?: boolean }): string {
  if (part.added) return "+ ";
  if (part.removed) return "- ";
  return "  ";
}

/**
 * A line diff of two file contents.
 *
 * @param before - The contents before the edit.
 * @param after - The contents after the edit.
 * @returns The diff, one prefixed line each.
 */
function renderDiff(before: string, after: string): string[] {
  return diffLines(before, after).flatMap((part) =>
    part.value
      .replace(/\n$/, "")
      .split("\n")
      .map((line) => `${prefixOf(part)}${line}`),
  );
}

/**
 * The preview block for an append to a file.
 *
 * @param current - The file's current contents.
 * @param change - The append change to render.
 * @returns The block's lines.
 */
function appendPreview(current: string, change: FileChange): string[] {
  if (change.guard && current.includes(change.guard)) {
    return [`${change.path}: already has a "${change.guard}" section`];
  }
  const appended = withAppendedLines(current, change.lines ?? []);
  if (appended.missing.length === 0) {
    return [`${change.path}: already has the gate's lines`];
  }
  return [
    `append to ${change.path}:`,
    ...appended.missing.map((line) => `+ ${line}`),
  ];
}

/**
 * The preview block for one change to an existing file.
 *
 * @param root - Absolute repository root.
 * @param change - The change to render.
 * @returns The block's lines.
 */
function changePreview(root: string, change: FileChange): string[] {
  const target = join(root, change.path);
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (change.kind === "append-lines") return appendPreview(current, change);
  const edited = withExtendsEntry(current, change.specifier ?? "", change.kind);
  if (edited.outcome === "already-extends") {
    return [`${change.path}: already extends ${change.specifier}`];
  }
  if (edited.outcome === "not-json") {
    return [`${change.path}: not plain JSON, will not be edited (see notes)`];
  }
  return [`edit ${change.path}:`, ...renderDiff(current, edited.contents)];
}

/**
 * The npm scripts already declared in the repository.
 *
 * @param root - Absolute repository root.
 * @returns The scripts, empty when package.json is missing or unreadable.
 */
function declaredScripts(root: string): Record<string, string> {
  try {
    const manifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    return manifest.scripts ?? {};
  } catch {
    return {};
  }
}

/**
 * The preview line for one planned script, honest about collisions.
 *
 * @param name - The script name.
 * @param command - The command the plan wants.
 * @param existing - The command already declared, if any.
 * @returns The line, a warning when the name is already taken.
 */
function scriptPreview(
  name: string,
  command: string,
  existing: string | undefined,
): string {
  if (existing === undefined) return `add script "${name}": ${command}`;
  if (existing === command) return `script "${name}": already set`;
  return `\u25b2 script "${name}" already exists, wanted: ${command}`;
}

/**
 * The closing lines: scripts, installs, the skill and the notes.
 *
 * @param root - Absolute repository root.
 * @param plan - The plan to render.
 * @returns The lines.
 */
function surroundingsPreview(root: string, plan: Plan): string[] {
  const declared = declaredScripts(root);
  return [
    ...Object.entries(plan.scripts).map(([name, command]) =>
      scriptPreview(name, command, declared[name]),
    ),
    plan.installs.length > 0
      ? `install with ${plan.packageManager}: ${plan.installs.join(", ")}`
      : "",
    ...plan.followUps.flatMap((followUp) => [
      `\u25b2 ${followUp.reason}`,
      followUp.kind === "command"
        ? `  offered after apply: ${followUp.command}`
        : `  offered after apply: replace script "${followUp.name}" with: ${followUp.command}`,
    ]),
    ...plan.notes.map((note) => `\u25b2 ${note}`),
  ].filter((line) => line.length > 0);
}

/**
 * Renders the full plan preview.
 *
 * @param root - Absolute repository root.
 * @param plan - The plan to render.
 * @returns The preview, ready to display before the confirm.
 */
export function planPreview(root: string, plan: Plan): string {
  const blocks = [
    ...plan.creations.map((creation) => [
      `create ${creation.path}:`,
      ...creation.contents
        .replace(/\n$/, "")
        .split("\n")
        .map((line) => `+ ${line}`),
    ]),
    ...plan.changes.map((change) => changePreview(root, change)),
    surroundingsPreview(root, plan),
  ];
  return blocks
    .filter((block) => block.length > 0)
    .map((block) => block.join("\n"))
    .join("\n\n");
}

/**
 * One line hard-wrapped to a width, the diff marker repeated on each piece.
 *
 * @param line - The line to wrap.
 * @param width - Maximum characters per piece, marker included.
 * @returns The pieces; the line itself when it already fits.
 */
function wrapLine(line: string, width: number): string[] {
  if (line.length <= width) return [line];
  const marker = /^([+-] | {2}|\u25b2 )/.exec(line)?.[1] ?? "";
  const body = line.slice(marker.length);
  const chunkSize = Math.max(1, width - marker.length);
  const count = Math.ceil(body.length / chunkSize);
  return Array.from(
    { length: count },
    (_, index) =>
      `${marker}${body.slice(index * chunkSize, (index + 1) * chunkSize)}`,
  );
}

/**
 * Hard-wraps a rendered preview so the note box around it survives narrow
 * terminals: a line wider than the box would be wrapped by the terminal
 * instead, breaking the border.
 *
 * @param preview - The rendered preview.
 * @param width - Maximum characters per line.
 * @returns The same preview with no line longer than the width.
 */
export function wrappedPreview(preview: string, width: number): string {
  const usable = Math.max(20, width);
  return preview
    .split("\n")
    .flatMap((line) => wrapLine(line, usable))
    .join("\n");
}

/** The style each kind of preview line gets; the first match wins. */
const LINE_STYLES: {
  matches(line: string): boolean;
  style: Parameters<typeof styleText>[0];
}[] = [
  { matches: (line) => line.startsWith("+ "), style: "green" },
  { matches: (line) => line.startsWith("- "), style: "red" },
  { matches: (line) => line.startsWith("  "), style: "dim" },
  { matches: (line) => line.startsWith("\u25b2 "), style: "yellow" },
  {
    matches: (line) => /^(create|edit|append to) .+:$/.test(line),
    style: "bold",
  },
];

/**
 * Colours a rendered preview: additions green, removals red, context dim,
 * notes yellow and block headers bold.
 *
 * @remarks Kept apart from {@link planPreview} so the preview itself stays
 * plain text, and painted unconditionally: the caller decides whether
 * colour is appropriate, not the stream heuristics.
 * @param preview - The rendered preview.
 * @returns The same preview with ANSI colours per line.
 */
export function paintedPreview(preview: string): string {
  return preview
    .split("\n")
    .map((line) => {
      const rule = LINE_STYLES.find((candidate) => candidate.matches(line));
      return rule
        ? styleText(rule.style, line, { validateStream: false })
        : line;
    })
    .join("\n");
}

/**
 * Wraps and paints content for a clack note box on this terminal.
 *
 * @param content - The plain content.
 * @returns The displayable content.
 */
export function boxedContent(content: string): string {
  const width = (process.stdout.columns ?? 80) - 8;
  const wrapped = wrappedPreview(content, width);
  return process.env.NO_COLOR ? wrapped : paintedPreview(wrapped);
}
