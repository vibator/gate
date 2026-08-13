/**
 * The declared-names analysis: the declarations whose names the project
 * chooses itself.
 *
 * @packageDocumentation
 */
import ts from "typescript";
import { type File, vibator } from "vibator";

/** One declaration whose name the project chose. */
export interface DeclaredName {
  /** The declared identifier text. */
  readonly name: string;
  /** The 1-based line the identifier starts on. */
  readonly line: number;
  /** The declaration node, for ignore markers. */
  readonly node: ts.Node;
}

/**
 * Whether a node declares a name the project chooses itself.
 *
 * @remarks A caught error is reached through its own variable declaration, so
 * the catch clause is not matched; doing both reports it twice. Properties
 * are excluded: they may mirror wire shapes and library contracts whose names
 * the project does not choose.
 * @param node - Any node.
 * @returns `true` for the forms the analysis yields.
 */
function isOwnNameDeclaration(node: ts.Node): boolean {
  return (
    ts.isParameter(node) ||
    ts.isVariableDeclaration(node) ||
    ts.isBindingElement(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node)
  );
}

/**
 * The names declared in a file, each with its line and node.
 *
 * @param file - The file to parse and walk.
 * @returns Every declaration whose name the project chose, in source order.
 */
export function declaredNames(file: File): DeclaredName[] {
  const ast = vibator.ts.parse(file);
  const found: DeclaredName[] = [];
  for (const cursor of ast.nodes) {
    if (!isOwnNameDeclaration(cursor.node)) continue;
    const { name } = cursor.node as ts.NamedDeclaration;
    if (!name || !ts.isIdentifier(name)) continue;
    found.push({
      name: name.text,
      line: ast.lineAt(name.getStart()),
      node: cursor.node,
    });
  }
  return found;
}
