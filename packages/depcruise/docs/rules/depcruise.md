# The dependency graph satisfies the cruiser ruleset

A finding means one dependency between two modules violates a rule in the
project's [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
configuration. What is checked depends entirely on that configuration: each
rule declares a name, a comment, and a from/to constraint. Common rules
forbid cycles, orphans, or imports across layer boundaries, but the ruleset
is the project's own.

## Resolving a finding

The message names the violated rule and the two modules, and lists the cycle
path when the violation is circular. The `expected` text carries the
ruleset's own comment for the rule, which states the intent.

- Restructure the dependency so the rule holds: move code, invert the
  dependency, or import from the allowed module instead.
- When the dependency is legitimate, adjust the ruleset: narrow the rule's
  `from`/`to` paths or add an exception. Rules can be declared in several
  forms; see the reference:
  <https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md>.
- There is no mechanical fix; `vibator --write` changes nothing for this
  rule.
- "dependency-cruiser configuration could not be loaded" means the
  `configPath` option names no file. Fix the path.

## Configuration

The ruleset comes from the rule's inline `config` option, its `configPath`
option, or `.dependency-cruiser.{js,cjs,mjs,json}` at the project root.
Without any configuration the cruise validates nothing and reports nothing.
Reference:
<https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md>.

## Silencing

- vibator marker on the line above the import:
  `// vibator-ignore depcruise: <reason>`, or for the whole file
  `// vibator-ignore-file depcruise: <reason>`.
- dependency-cruiser has no inline suppression comment; exceptions live in
  the ruleset (`pathNot`, severity `ignore`). See the rules reference above.
