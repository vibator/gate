# The `prefer-array-methods` rule

This document is the reference of the `prefer-array-methods` rule: its
options, the loops it judges, and the diagnostics it produces. The rule is
written against the
[`vibator.recommended` namespace](./recommended-namespace.md).

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [Detection](#detection): The loops it judges.
- [Diagnostics](#diagnostics): One finding per replaceable loop.
- [Fix](#fix): Why there is none.

---

## Configuration

The rule id is `prefer-array-methods`. It defaults to `warn`. Configure it
in `.vibator.json`:

```json
{
  "plugins": [
    "@vibator/recommended"
  ],
  "rules": {
    "prefer-array-methods": {
      "options": {
        "include": ["src/**/*.{ts,tsx}"]
      }
    }
  }
}
```

| Option            | Description                                                                                   |
|-------------------|-----------------------------------------------------------------------------------------------|
| include / exclude | The shared vibator scope globs. `exclude` adds `**/*.d.ts`: declaration files carry no loops. |

## Detection

The rule judges `for`, `for-of`, and `for-in` loops through
`vibator.recommended.manualLoops`: a loop is reported when its body is a
single statement with no `break`, `continue`, `return` or `await`. Nested
functions are not descended into, so control flow inside a callback does not
excuse the outer loop. `vibator-ignore prefer-array-methods` markers are
honored at file level and on the loop or any enclosing scope.

## Diagnostics

One diagnostic per replaceable loop, on the line the loop starts on.

## Fix

Which array method fits (`forEach`, `map`, `filter`, `flatMap`, `reduce`)
depends on what the loop means, and the check is syntactic: a loop over a
`Set` or a generator has no direct rewrite at all. The rule ships as `warn`
for the same reason, and implements no `fix` hook.
