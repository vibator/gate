/**
 * The TSDoc analysis: every declaration carries a complete documentation
 * contract.
 *
 * @remarks Purely syntactic: no type checker is consulted, so this runs
 * without a tsconfig and costs a parse per file rather than a type-check.
 *
 * @packageDocumentation
 */
import ts from "typescript";
import { type File, vibator } from "vibator";
import {
  checkClassMembers,
  checkFunction,
  checkVariableStatement,
} from "./tsdoc-functions.ts";
import {
  checkInlineCommentLength,
  checkMemberComments,
} from "./tsdoc-members.ts";

/** The knobs the TSDoc analysis exposes. */
export interface TsdocOptions {
  /** Which declarations must carry documentation. */
  requireOn: "all" | "exported";
  /** Whether every parameter needs a `@param` tag. */
  requireParams: boolean;
  /** Whether value-returning signatures need a `@returns` tag. */
  requireReturns: boolean;
  /** Longest run of consecutive own-line `//` comments allowed. */
  maxInlineCommentLines: number;
}

/** A documentation violation, pointing at the offending declaration. */
export interface TsdocViolation {
  /** The 1-based line the declaration starts on. */
  line: number;
  /** The declaration being reported. */
  symbol: string;
  /** What the reader should change. */
  problem: string;
}

/**
 * Whether a statement is exported from its module.
 *
 * @param statement - The statement to inspect.
 * @returns `true` when an `export` modifier is present.
 */
function isExported(statement: ts.Statement): boolean {
  const modifiers = (statement as { modifiers?: readonly ts.ModifierLike[] })
    .modifiers;
  return (modifiers ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );
}

/**
 * Checks one top-level statement, whichever documentable form it takes.
 *
 * @param sourceFile - The file the statement belongs to.
 * @param statement - The statement to inspect.
 * @param options - The analysis options.
 * @param violations - The violation sink.
 */
function checkStatement(
  sourceFile: ts.SourceFile,
  statement: ts.Statement,
  options: TsdocOptions,
  violations: TsdocViolation[],
): void {
  if (ts.isFunctionDeclaration(statement) && statement.name) {
    checkFunction(
      sourceFile,
      statement,
      statement,
      statement.name.text,
      options,
      violations,
    );
  } else if (ts.isVariableStatement(statement)) {
    checkVariableStatement(sourceFile, statement, options, violations);
  } else if (ts.isClassDeclaration(statement)) {
    checkClassMembers(sourceFile, statement, options, violations);
  }
}

/**
 * Collects every documentation violation in one file.
 *
 * @remarks Under `requireOn: "exported"`, module-local declarations are left
 * alone: the bar applies only to the surface other files consume.
 * @param file - The file to parse and analyse.
 * @param options - The analysis options.
 * @returns The violations found, in source order.
 */
export function tsdocViolations(
  file: File,
  options: TsdocOptions,
): TsdocViolation[] {
  const sourceFile = vibator.ts.parse(file).source;
  const violations: TsdocViolation[] = [];
  const localExempt = options.requireOn === "exported";
  for (const statement of sourceFile.statements) {
    if (localExempt && !isExported(statement)) continue;
    checkStatement(sourceFile, statement, options, violations);
  }
  checkMemberComments(sourceFile, violations);
  checkInlineCommentLength(
    sourceFile,
    options.maxInlineCommentLines,
    violations,
  );
  return violations;
}
