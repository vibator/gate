/**
 * The pure file transforms behind the wizard's surgical changes. Preview
 * and apply both run these, so the diff shown before confirming is exactly
 * what gets written.
 *
 * @packageDocumentation
 */
import type { FileChange } from "./plan.ts";

/** What adding an extends entry to a JSON config resolved to. */
export type ExtendsEdit =
  | { outcome: "updated"; contents: string }
  | { outcome: "already-extends" }
  | { outcome: "not-json" };

/** What appending lines to a file resolved to. */
export interface AppendEdit {
  /** The file's new contents; unset when nothing was missing. */
  contents?: string;
  /** The lines that were missing. */
  missing: string[];
}

/**
 * The extends value after adding the gate's entry.
 *
 * @param existing - The file's current extends value, if any.
 * @param specifier - The gate export to add.
 * @param kind - The change kind; tsconfig prefers a bare string when alone.
 * @returns The new value, with the gate first so local settings win.
 */
function nextExtends(
  existing: unknown,
  specifier: string,
  kind: FileChange["kind"],
): unknown {
  if (existing === undefined) {
    return kind === "tsconfig-extends" ? specifier : [specifier];
  }
  const entries = Array.isArray(existing) ? existing : [existing];
  return [specifier, ...entries];
}

/**
 * Adds an extends entry to a JSON configuration's text.
 *
 * @param raw - The file's current contents.
 * @param specifier - The gate export to point at.
 * @param kind - The change kind driving the extends shape.
 * @returns The new contents, or why nothing changes.
 */
export function withExtendsEntry(
  raw: string,
  specifier: string,
  kind: FileChange["kind"],
): ExtendsEdit {
  if (raw.includes(specifier)) return { outcome: "already-extends" };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { outcome: "not-json" };
  }
  parsed.extends = nextExtends(parsed.extends, specifier, kind);
  return {
    outcome: "updated",
    contents: `${JSON.stringify(parsed, null, 2)}\n`,
  };
}

/**
 * Appends the lines a file's text is missing.
 *
 * @param current - The file's current contents; empty when it is new.
 * @param lines - The lines the file must contain.
 * @returns The new contents and which lines were missing.
 */
export function withAppendedLines(
  current: string,
  lines: string[],
): AppendEdit {
  const missing = lines.filter((line) => !current.includes(line));
  if (missing.length === 0) return { missing };
  const separator = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
  return {
    contents: `${current}${separator}${missing.join("\n")}\n`,
    missing,
  };
}
