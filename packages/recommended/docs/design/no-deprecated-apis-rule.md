# The `no-deprecated-apis` rule

This document is the reference of the `no-deprecated-apis` rule: its
options, the usages it resolves, and the diagnostics it produces. The rule
is written against the
[`vibator.recommended` namespace](./recommended-namespace.md).

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [Detection](#detection): How usages resolve to deprecated declarations.
- [Diagnostics](#diagnostics): One finding per usage.
- [Errors](#errors): What happens when a program cannot build.
- [Fix](#fix): Why there is none.

---

## Configuration

The rule id is `no-deprecated-apis`. Configure it in `.vibator.json`:

```json
{
  "plugins": [
    "@vibator/recommended"
  ],
  "rules": {
    "no-deprecated-apis": {
      "options": {
        "include": ["src/**/*.{ts,tsx}"],
        "projects": ["tsconfig.json"]
      }
    }
  }
}
```

| Option            | Description                                                                         |
|-------------------|-------------------------------------------------------------------------------------|
| include / exclude | The shared vibator scope globs. `exclude` adds `**/*.d.ts`.                         |
| projects          | tsconfig paths whose programs resolve the symbols. Defaults to `["tsconfig.json"]`. |

## Detection

The rule builds a type-checked program per project through
`vibator.ts.program` and walks the program files in scope through
`vibator.recommended.deprecatedUsages`. Calls are judged by the overload
they resolve to, so one deprecated overload does not taint the others.
Object-literal keys resolve through the contextual type, so a deprecated
option in a config object is found. Import aliases unwrap to the symbol they
name, and a declaration site never reports itself. A file appearing in two
projects is visited once. `vibator-ignore no-deprecated-apis` markers are
honored at file level and on the usage or any enclosing scope.

## Diagnostics

One diagnostic per usage, on the identifier's line. The `expected` field
carries the `@deprecated` tag's own replacement advice, or "no replacement
given" when the tag is bare.

## Errors

A `projects` entry whose program cannot build produces one project-level
diagnostic instead of a crash.

## Fix

The replacement is stated, but applying it changes call sites in ways only
the surrounding code can justify. The rule implements no `fix` hook.
