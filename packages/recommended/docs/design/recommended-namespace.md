# The `vibator.recommended` namespace

This document is the reference of the `recommended` subnamespace: the
TypeScript syntax analyses the AST rules are written against. The namespace
is the only part of the package that imports the `typescript` module.

## Reference

- [Functions](#functions): The analyses the subnamespace exposes.
- [Results](#results): The value each analysis returns.
- [Parsing](#parsing): Where syntax trees and programs come from.

---

## Functions

| Function                          | Returns             | Used by                |
|-----------------------------------|---------------------|------------------------|
| `declaredNames(file)`             | `DeclaredName[]`    | `meaningful-names`     |
| `manualLoops(file)`               | `ManualLoop[]`      | `prefer-array-methods` |
| `tsdocViolations(file, options)`  | `TsdocViolation[]`  | `tsdoc-coverage`       |
| `deprecatedUsages(program, file)` | `DeprecatedUsage[]` | `no-deprecated-apis`   |

## Results

| Type              | Fields                                                                                     |
|-------------------|--------------------------------------------------------------------------------------------|
| `DeclaredName`    | `name`, `line`, `node`: a declaration whose name the project chose.                        |
| `ManualLoop`      | `line`, `node`: a loop an array method could replace.                                      |
| `TsdocViolation`  | `line`, `symbol`, `problem`: a documentation gap.                                          |
| `DeprecatedUsage` | `line`, `name`, `replacement`, `node`: an identifier reaching a `@deprecated` declaration. |

Results carrying a `node` let rules honor `vibator.ignore.node` markers on
the declaration or an enclosing scope.

## Parsing

`declaredNames`, `manualLoops`, and `tsdocViolations` are syntactic: they
parse through `vibator.ts.parse` and need no tsconfig. `deprecatedUsages`
resolves symbols, so its caller supplies a type-checked program from
`vibator.ts.program`.
