/**
 * The manual-loops analysis: loops whose body an array method could express.
 *
 * @packageDocumentation
 */
import ts from "typescript";
import { type File, vibator } from "vibator";

/** One loop an array method could replace. */
export interface ManualLoop {
  /** The 1-based line the loop starts on. */
  readonly line: number;
  /** The loop node, for ignore markers. */
  readonly node: ts.Node;
}

/**
 * Whether a loop body contains control flow an array method cannot express.
 *
 * @remarks `break`, `continue`, `return` and `await` are the honest reasons
 * to keep a loop, so a body using any of them is left alone. Nested functions
 * are not descended into: a `break` there belongs to some inner loop, not
 * this one.
 * @param body - The loop body.
 * @returns `true` when the loop earns its place.
 */
function hasEscapingControlFlow(body: ts.Node): boolean {
  let escapes = false;

  const visit = (node: ts.Node): void => {
    if (escapes) return;
    if (
      ts.isBreakStatement(node) ||
      ts.isContinueStatement(node) ||
      ts.isAwaitExpression(node) ||
      ts.isReturnStatement(node)
    ) {
      escapes = true;
      return;
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(body);
  return escapes;
}

/**
 * How many statements a loop body holds.
 *
 * @param body - The loop body.
 * @returns The statement count, treating a bare statement as one.
 */
function statementCount(body: ts.Statement): number {
  return ts.isBlock(body) ? body.statements.length : 1;
}

/**
 * Whether a node is a `for`, `for-of`, or `for-in` loop.
 *
 * @param node - Any node.
 * @returns Whether the node is a loop the analysis judges.
 */
function isLoop(node: ts.Node): node is ts.IterationStatement {
  return (
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node)
  );
}

/**
 * The loops in a file that an array method could replace: bodies of a single
 * statement with no `break`, `continue`, `return` or `await`.
 *
 * @param file - The file to parse and walk.
 * @returns Every replaceable loop, in source order.
 */
export function manualLoops(file: File): ManualLoop[] {
  return vibator.ts
    .parse(file)
    .nodes.filter((cursor) => {
      if (!isLoop(cursor.node)) return false;
      const loop = cursor.node as ts.IterationStatement;
      return (
        statementCount(loop.statement) === 1 &&
        !hasEscapingControlFlow(loop.statement)
      );
    })
    .map((cursor) => ({ line: cursor.line, node: cursor.node }));
}
