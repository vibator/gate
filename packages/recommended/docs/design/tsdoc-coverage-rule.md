# The `tsdoc-coverage` rule

This document is the reference of the `tsdoc-coverage` rule: its options,
the declarations it judges, and the diagnostics it produces. The rule is
written against the
[`vibator.recommended` namespace](./recommended-namespace.md).

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [Detection](#detection): The documentation contract it checks.
- [Diagnostics](#diagnostics): One finding per violation.
- [Fix](#fix): Why there is none.

---

## Configuration

The rule id is `tsdoc-coverage`. Configure it in `.vibator.json`:

```json
{
  "plugins": [
    "@vibator/recommended"
  ],
  "rules": {
    "tsdoc-coverage": {
      "options": {
        "include": ["src/**/*.{ts,tsx}"],
        "requireOn": "exported"
      }
    }
  }
}
```

| Option                | Description                                                                               |
|-----------------------|-------------------------------------------------------------------------------------------|
| include / exclude     | The shared vibator scope globs. `exclude` adds `**/*.d.ts`.                               |
| requireOn             | `all` (the default) or `exported`, the gentler bar for a codebase adopting the rule late. |
| requireParams         | Whether every parameter needs a `@param` tag. Defaults to `true`.                         |
| requireReturns        | Whether value-returning signatures need a `@returns` tag. Defaults to `true`.             |
| maxInlineCommentLines | Longest run of consecutive own-line `//` comments allowed. Defaults to 2.                 |

## Detection

The rule covers the contract, not the prose, through
`vibator.recommended.tsdocViolations`: a TSDoc block on every function,
`const fn = ...` binding, and class member; a `@param` per parameter
(`this` exempt, destructured parameters claim tags positionally); a
`@returns` when the annotation or body shows an observable value
(`void`, `never`, `Promise<void>`, assertion signatures, and type
predicates are exempt); type members documented with TSDoc rather than a
`//` comment; and `//` runs kept under the cap, past which the explanation
belongs in the enclosing TSDoc. The analysis is syntactic; no tsconfig is
needed. `vibator-ignore tsdoc-coverage` markers are honored at file and
line level.

## Diagnostics

One diagnostic per violation, on the declaration's line, naming the symbol
and what to change.

## Fix

The missing words are the point: only the author knows the contract. The
rule implements no `fix` hook.
