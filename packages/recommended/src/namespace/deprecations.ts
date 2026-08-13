/**
 * The deprecation analysis: identifiers reaching a `@deprecated` declaration.
 *
 * @remarks Answering "is this identifier deprecated?" holds the subtleties:
 * an overloaded call must be judged by the overload it actually resolves to,
 * and an option written in a config object must be looked up on the type the
 * object is assigned to rather than on the object itself.
 *
 * @packageDocumentation
 */
import ts from "typescript";
import type { File, Program } from "vibator";

/** One identifier reaching a deprecated declaration. */
export interface DeprecatedUsage {
  /** The 1-based line the identifier sits on. */
  readonly line: number;
  /** The identifier written in the source. */
  readonly name: string;
  /** What the author of the deprecated declaration says to use instead. */
  readonly replacement: string;
  /** The identifier node, for ignore markers. */
  readonly node: ts.Node;
}

/** An identifier reaching a deprecated declaration, and the advice on it. */
interface DeprecatedUse {
  /** The identifier written in the source. */
  node: ts.Identifier;
  /** What the author of the deprecated declaration says to use instead. */
  replacement: string;
}

/** Returned when a `@deprecated` tag carries no replacement text. */
const NO_REPLACEMENT = "no replacement given";

/**
 * Collapses tag prose onto one line.
 *
 * @param text - The raw tag text.
 * @returns The text with runs of whitespace collapsed, or a stand-in when
 * bare.
 */
function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim() || NO_REPLACEMENT;
}

/**
 * The replacement advice on a symbol, when it is deprecated.
 *
 * @param symbol - The resolved symbol.
 * @returns The `@deprecated` text, or `undefined` when it is not deprecated.
 */
function deprecationOf(symbol: ts.Symbol): string | undefined {
  const tag = symbol
    .getJsDocTags()
    .find((entry) => entry.name === "deprecated");
  if (!tag) return undefined;
  return tidy((tag.text ?? []).map((part) => part.text).join(""));
}

/**
 * Looks a property up on a contextual type, including union members.
 *
 * @remarks Option bags are routinely typed as unions, and asking a union for
 * a property only succeeds when every member declares it. The deprecated
 * option usually lives on one member, so each is tried in turn.
 * @param contextual - The contextual type of the enclosing object literal.
 * @param name - The property being written.
 * @returns The property symbol, or `undefined` when no member declares it.
 */
function propertyOf(contextual: ts.Type, name: string): ts.Symbol | undefined {
  const direct = contextual.getProperty(name);
  if (direct) return direct;
  if (!contextual.isUnion()) return undefined;

  return contextual.types
    .map((member) => member.getProperty(name))
    .find((member) => member !== undefined);
}

/**
 * Follows an import alias to the symbol it actually names.
 *
 * @remarks An imported function resolves to the local import binding, whose
 * declaration is the import specifier and carries no documentation of its
 * own. Skipping this step makes every deprecated import invisible.
 * @param checker - The program's type checker.
 * @param symbol - The symbol to unwrap, if any.
 * @returns The aliased symbol, or the original when it is not an alias.
 */
function unwrapAlias(
  checker: ts.TypeChecker,
  symbol: ts.Symbol | undefined,
): ts.Symbol | undefined {
  if (!symbol) return undefined;
  return symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
}

/**
 * Resolves the symbol an identifier refers to.
 *
 * @remarks A key in an object literal resolves to the literal's own property,
 * which carries no documentation. The tag lives on the property of the type
 * the literal is assigned to, so those resolve through the contextual type.
 * Without this, every deprecated option in a config file is invisible.
 * @param checker - The program's type checker.
 * @param node - The identifier being inspected.
 * @returns The declared symbol, unwrapped through any import alias.
 */
function symbolFor(
  checker: ts.TypeChecker,
  node: ts.Identifier,
): ts.Symbol | undefined {
  const { parent } = node;
  let direct: ts.Symbol | undefined;

  if (ts.isPropertyAssignment(parent) && parent.name === node) {
    const contextual = checker.getContextualType(parent.parent);
    direct = contextual ? propertyOf(contextual, node.text) : undefined;
  } else {
    direct = checker.getSymbolAtLocation(node);
  }
  return unwrapAlias(checker, direct);
}

/**
 * Whether a call is worth resolving a signature for.
 *
 * @remarks Resolving a signature forces real type resolution and is the
 * single most expensive thing this analysis does. The callee's symbol is far
 * cheaper to resolve and rules most calls out: a deprecated overload has to
 * be declared somewhere on that symbol. An unresolvable symbol falls through
 * to the full check, because "unknown" must not mean "fine".
 * @param checker - The program's type checker.
 * @param callee - The identifier naming the called function.
 * @returns `true` when the signature must be resolved to decide.
 */
function mayBeDeprecated(
  checker: ts.TypeChecker,
  callee: ts.Identifier,
): boolean {
  const symbol = unwrapAlias(checker, checker.getSymbolAtLocation(callee));
  if (!symbol) return true;

  return (symbol.declarations ?? []).some((declaration) =>
    ts.getJSDocDeprecatedTag(declaration),
  );
}

/**
 * The identifier naming the function a call invokes.
 *
 * @param call - The call expression.
 * @returns The callee identifier, or `undefined` when the callee names
 * nothing.
 */
function calleeIdentifier(call: ts.CallExpression): ts.Identifier | undefined {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee;
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
    return callee.name;
  }
  return undefined;
}

/**
 * Whether an identifier names the function being invoked by its parent call.
 *
 * @remarks Calls are judged by resolved signature instead, so the
 * symbol-level path must skip them or every deprecated call reports twice.
 * @param node - The identifier being inspected.
 * @returns `true` when the identifier is a call's callee.
 */
function isCallee(node: ts.Identifier): boolean {
  const { parent } = node;
  if (ts.isCallExpression(parent)) return parent.expression === node;
  return (
    ts.isPropertyAccessExpression(parent) &&
    parent.name === node &&
    ts.isCallExpression(parent.parent) &&
    parent.parent.expression === parent
  );
}

/**
 * The replacement advice for the specific overload a call resolves to.
 *
 * @remarks A symbol merges the documentation of every overload, so asking it
 * whether `querySelectorAll` is deprecated answers yes on the strength of a
 * deprecated overload nobody called. Only the signature actually selected at
 * this call site is relevant.
 * @param checker - The program's type checker.
 * @param call - The call expression.
 * @returns The `@deprecated` text, or `undefined` when the overload is
 * current.
 */
function callDeprecation(
  checker: ts.TypeChecker,
  call: ts.CallExpression,
): string | undefined {
  const declaration = checker.getResolvedSignature(call)?.declaration;
  if (!declaration) return undefined;

  const tag = ts.getJSDocDeprecatedTag(declaration);
  if (!tag) return undefined;
  return tidy(typeof tag.comment === "string" ? tag.comment : "");
}

/**
 * Whether an identifier is the name of the declaration it resolves to.
 *
 * @remarks Declaring something deprecated is not using it, so a declaration
 * site must not report itself.
 * @param symbol - The resolved symbol.
 * @param node - The identifier being inspected.
 * @returns `true` when the identifier is its own declaration's name.
 */
function isDeclarationSite(symbol: ts.Symbol, node: ts.Identifier): boolean {
  return (symbol.declarations ?? []).some(
    (declaration) => (declaration as ts.NamedDeclaration).name === node,
  );
}

/**
 * The deprecated overload a call resolves to, if it resolves to one.
 *
 * @param checker - The program's type checker.
 * @param call - The call expression to inspect.
 * @returns The callee and its replacement advice, or `undefined`.
 */
function deprecatedCall(
  checker: ts.TypeChecker,
  call: ts.CallExpression,
): DeprecatedUse | undefined {
  const callee = calleeIdentifier(call);
  if (!callee) return undefined;
  if (!mayBeDeprecated(checker, callee)) return undefined;

  const replacement = callDeprecation(checker, call);
  return replacement ? { node: callee, replacement } : undefined;
}

/**
 * The deprecated declaration a plain identifier refers to, if any.
 *
 * @param checker - The program's type checker.
 * @param node - The identifier to inspect.
 * @returns The identifier and its replacement advice, or `undefined`.
 */
function deprecatedReference(
  checker: ts.TypeChecker,
  node: ts.Identifier,
): DeprecatedUse | undefined {
  if (isCallee(node)) return undefined;

  const symbol = symbolFor(checker, node);
  if (!symbol || isDeclarationSite(symbol, node)) return undefined;

  const replacement = deprecationOf(symbol);
  return replacement ? { node, replacement } : undefined;
}

/**
 * The deprecated identifier a node uses, if it uses one.
 *
 * @param checker - The program's type checker.
 * @param node - The node to inspect.
 * @returns The offending identifier and its replacement advice, or
 * `undefined`.
 */
function deprecatedUse(
  checker: ts.TypeChecker,
  node: ts.Node,
): DeprecatedUse | undefined {
  if (ts.isCallExpression(node)) return deprecatedCall(checker, node);
  if (ts.isIdentifier(node)) return deprecatedReference(checker, node);
  return undefined;
}

/**
 * Every deprecated usage in one file of a type-checked program.
 *
 * @param program - The program the file belongs to.
 * @param file - The file to walk.
 * @returns Every usage, in source order.
 */
export function deprecatedUsages(
  program: Program,
  file: File,
): DeprecatedUsage[] {
  const ast = program.ast(file);
  return ast.nodes.flatMap((cursor) => {
    const used = deprecatedUse(program.checker, cursor.node);
    if (!used) return [];
    return [
      {
        line: ast.lineAt(used.node.getStart()),
        name: used.node.text,
        replacement: used.replacement,
        node: used.node,
      },
    ];
  });
}
