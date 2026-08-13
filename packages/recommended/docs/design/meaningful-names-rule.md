# The `meaningful-names` rule

This document is the reference of the `meaningful-names` rule: its options,
the declarations it judges, and the diagnostics it produces. The rule is
written against the
[`vibator.recommended` namespace](./recommended-namespace.md).

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [Detection](#detection): The declarations and names it judges.
- [Diagnostics](#diagnostics): One finding per bad name.
- [Fix](#fix): Why there is none.

---

## Configuration

The rule id is `meaningful-names`. Configure it in `.vibator.json`:

```json
{
  "plugins": [
    "@vibator/recommended"
  ],
  "rules": {
    "meaningful-names": {
      "options": {
        "include": ["src/**/*.{ts,tsx}"]
      }
    }
  }
}
```

| Option            | Description                                                                                 |
|-------------------|---------------------------------------------------------------------------------------------|
| include / exclude | The shared vibator scope globs. `exclude` adds `**/*.d.ts`: declaration files mirror APIs.  |
| minLength         | Identifiers shorter than this must be allowlisted. Defaults to 3.                           |
| allow             | Short names that carry meaning, or that a library imposes. Defaults include `id`, `x`, `y`. |
| deny              | Names long enough to pass the bar but still meaningless. Defaults include `data`, `tmp`.    |

## Detection

The rule judges the declarations whose names the project chooses itself:
parameters, variables, binding elements, functions, methods, classes,
interfaces, type aliases, and enums, through
`vibator.recommended.declaredNames`. Properties are excluded because they
may mirror wire shapes, and names starting with `_` are conventionally
unused. A denied name is reported at any length; a name shorter than
`minLength` is reported unless allowlisted. `vibator-ignore
meaningful-names` markers are honored at file level and on the declaration
or any enclosing scope.

## Diagnostics

One diagnostic per bad name, on the line of the identifier, stating whether
the name is a filler or too short.

## Fix

The right name needs to say what the value is, which no tool can know. The
rule implements no `fix` hook.
