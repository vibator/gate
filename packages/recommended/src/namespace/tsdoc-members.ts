/**
 * The TSDoc checks over type members, and the inline comment length bar.
 *
 * @packageDocumentation
 */
import ts from "typescript";
import type { TsdocViolation } from "./tsdoc.ts";
import { hasLeadingComment, jsDocsOf, lineOf } from "./tsdoc-functions.ts";

/** The "properties" of the analysis: members documented where they sit. */
type DocumentedMember =
  | ts.PropertySignature
  | ts.MethodSignature
  | ts.PropertyDeclaration
  | ts.EnumMember;

/**
 * Type guard for {@link DocumentedMember}, on interfaces, type literals,
 * classes, and enums alike.
 *
 * @param node - The node to test.
 * @returns Whether the node is a documented member form.
 */
function isDocumentedMember(node: ts.Node): node is DocumentedMember {
  return (
    ts.isPropertySignature(node) ||
    ts.isMethodSignature(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isEnumMember(node)
  );
}

/**
 * Reports every member documented with a `//` comment instead of TSDoc.
 *
 * @remarks Members that already carry a TSDoc block pass, so a `//` section
 * divider above one is still fine.
 * @param sourceFile - The file to scan.
 * @param violations - The violation sink.
 */
export function checkMemberComments(
  sourceFile: ts.SourceFile,
  violations: TsdocViolation[],
): void {
  const visit = (node: ts.Node): void => {
    if (
      isDocumentedMember(node) &&
      jsDocsOf(node).length === 0 &&
      hasLeadingComment(sourceFile, node)
    ) {
      violations.push({
        line: lineOf(sourceFile, node.getStart()),
        symbol: node.name?.getText() ?? "(member)",
        problem: "document the member with TSDoc, not a `//` comment",
      });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
}

/**
 * Records the `//` ranges attached to one token position.
 *
 * @param sourceFile - The file being scanned.
 * @param position - A token's full start, whose trivia is read.
 * @param found - Sink keyed by range start, so shared trivia is stored once.
 */
function collectLineComments(
  sourceFile: ts.SourceFile,
  position: number,
  found: Map<number, ts.TextRange>,
): void {
  const leading = ts.getLeadingCommentRanges(sourceFile.text, position) ?? [];
  const trailing = ts.getTrailingCommentRanges(sourceFile.text, position) ?? [];
  for (const range of [...leading, ...trailing]) {
    if (range.kind !== ts.SyntaxKind.SingleLineCommentTrivia) continue;
    found.set(range.pos, { pos: range.pos, end: range.end });
  }
}

/**
 * Every `//` comment in a file, as text ranges.
 *
 * @remarks Read from the parsed tree's trivia rather than by re-lexing the
 * text. A bare scanner carries no parser context, so a backtick inside a
 * TSDoc block reads as a template literal and swallows every comment after
 * it.
 * @param sourceFile - The file to scan.
 * @returns The ranges, in source order.
 */
function singleLineComments(sourceFile: ts.SourceFile): ts.TextRange[] {
  const found = new Map<number, ts.TextRange>();
  const visit = (node: ts.Node): void => {
    collectLineComments(sourceFile, node.getFullStart(), found);
    node.getChildren(sourceFile).forEach(visit);
  };
  visit(sourceFile);
  return [...found.values()].sort((left, right) => left.pos - right.pos);
}

/**
 * The lines carrying a `//` comment that opens its own line.
 *
 * @remarks Only these form a block; a trailing `// note` after code is a
 * single remark, not part of a run.
 * @param sourceFile - The file to scan.
 * @returns The 1-based line numbers, in source order.
 */
function ownLineComments(sourceFile: ts.SourceFile): number[] {
  return singleLineComments(sourceFile)
    .filter((range) => {
      const lineStart =
        sourceFile.getLineStarts()[lineOf(sourceFile, range.pos) - 1] ?? 0;
      return sourceFile.text.slice(lineStart, range.pos).trim() === "";
    })
    .map((range) => lineOf(sourceFile, range.pos));
}

/**
 * Groups comment lines into runs.
 *
 * @remarks Consecutive `//` lines are one block; a blank line or any code
 * ends it.
 * @param lines - The own-line comment lines, in source order.
 * @returns A map from each run's first line to its length.
 */
function commentRunLengths(lines: number[]): Map<number, number> {
  const runs = new Map<number, number>();
  let start = -1;
  let previous = -2;
  for (const line of lines) {
    if (line !== previous + 1) start = line;
    runs.set(start, (runs.get(start) ?? 0) + 1);
    previous = line;
  }
  return runs;
}

/**
 * Reports every `//` run longer than the cap; past it, the run is an
 * explanation that belongs in the enclosing TSDoc.
 *
 * @param sourceFile - The file to scan.
 * @param cap - Longest run of consecutive own-line `//` comments allowed.
 * @param violations - The violation sink.
 */
export function checkInlineCommentLength(
  sourceFile: ts.SourceFile,
  cap: number,
  violations: TsdocViolation[],
): void {
  for (const [line, length] of commentRunLengths(ownLineComments(sourceFile))) {
    if (length <= cap) continue;
    violations.push({
      line,
      symbol: "(inline comment)",
      problem: `${length}-line \`//\` block exceeds ${cap}; move it into the enclosing TSDoc`,
    });
  }
}
