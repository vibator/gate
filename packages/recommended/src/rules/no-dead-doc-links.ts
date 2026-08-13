/**
 * The `no-dead-doc-links` rule: relative links in Markdown point at files
 * that exist.
 *
 * @packageDocumentation
 */
import { dirname, resolve } from "node:path";
import {
  type Diagnostic,
  defineRule,
  type File,
  scope,
  vibator,
} from "vibator";
import { z } from "zod";

const RULE_ID = "no-dead-doc-links";

/**
 * A Markdown link or image whose target is inside the repository.
 *
 * @remarks External URLs, `mailto:` and pure `#anchor` links are someone
 * else's availability problem; the rule only judges what a commit in this
 * repository can break.
 */
const LINK = /!?\[[^\]]*\]\(<?([^)<>\s]+)>?(?:\s+"[^"]*")?\)/g;

const options = scope.extend({
  /** Markdown files, where nothing else checks that references resolve. */
  include: z
    .array(z.string())
    .default(["**/*.md"])
    .describe("Glob patterns selecting the files the rule judges"),
});

/**
 * Whether a link target is out of this rule's jurisdiction.
 *
 * @param target - The raw link target.
 * @returns `true` for external, protocol, or anchor-only targets.
 */
function isExternal(target: string): boolean {
  return /^[a-z][a-z+.-]*:/i.test(target) || target.startsWith("#");
}

/**
 * Whether a path names a file or folder in the repository.
 *
 * @param absolute - The absolute path the link resolves to.
 * @returns Whether something exists at the path.
 */
function exists(absolute: string): boolean {
  try {
    vibator.project.files.get(absolute).bytes;
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EISDIR";
  }
}

/**
 * Resolves a link target against the file it appears in.
 *
 * @param file - The Markdown file holding the link.
 * @param target - The target with anchor and query stripped.
 * @returns The absolute path the link points at.
 */
function resolveTarget(file: File, target: string): string {
  return target.startsWith("/")
    ? resolve(vibator.project.root, target.slice(1))
    : resolve(dirname(file.path), target);
}

/**
 * Judges one link target.
 *
 * @param file - The Markdown file holding the link.
 * @param line - The 1-based line the link appears on.
 * @param target - The raw link target.
 * @returns A diagnostic when the target is a missing repository file.
 */
function judgeTarget(file: File, line: number, target: string): Diagnostic[] {
  if (isExternal(target)) return [];
  const path = (target.split(/[#?]/)[0] ?? "").trim();
  if (path === "" || exists(resolveTarget(file, path))) return [];
  if (vibator.ignore.line(file, line, RULE_ID)) return [];
  return [
    {
      file: file.path,
      line,
      message: `Link target does not exist: ${target}`,
      expected: "Every relative link resolves to a file in the repository",
      fix: `Fix the path or remove the link; ${path} does not exist`,
    },
  ];
}

/**
 * Finds every dead link in one file, reading links from the content with
 * code fences and spans blanked so examples do not count.
 *
 * @param file - The Markdown file to judge.
 * @returns The diagnostics for the file.
 */
function fileDiagnostics(file: File): Diagnostic[] {
  const masked = vibator.text.maskCode(file);
  return [...masked.matchAll(LINK)].flatMap((match) => {
    const line = vibator.text.positionAt(file, match.index).line;
    return judgeTarget(file, line, match[1] ?? "");
  });
}

export default defineRule({
  id: RULE_ID,
  title: "Relative links in Markdown point at files that exist",
  docs: "@vibator/recommended:docs/rules/no-dead-doc-links.md",
  options,
  check({ include, exclude }) {
    const globs = [...include, ...exclude.map((glob) => `!${glob}`)];
    const diagnostics: Diagnostic[] = [];
    vibator.project.files.match(globs).forEach((file) => {
      if (vibator.ignore.file(file, RULE_ID)) return;
      diagnostics.push(...fileDiagnostics(file));
    });
    return { diagnostics };
  },
});
