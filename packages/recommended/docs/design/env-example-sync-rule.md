# The `env-example-sync` rule

This document is the reference of the `env-example-sync` rule: its options,
what counts as a read and as documentation, and the diagnostics it produces.

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [Detection](#detection): What counts as a read and as documentation.
- [Diagnostics](#diagnostics): Drift in both directions.
- [Fix](#fix): Why there is none.

---

## Configuration

The rule id is `env-example-sync`. It defaults to `warn`. Configure it in
`.vibator.json`:

```json
{
  "plugins": [
    "@vibator/recommended"
  ],
  "rules": {
    "env-example-sync": {
      "options": {
        "include": ["src/**/*.{ts,tsx,js,jsx}"]
      }
    }
  }
}
```

| Option             | Description                                                                                    |
|--------------------|------------------------------------------------------------------------------------------------|
| include / exclude  | The shared vibator scope globs selecting the sources scanned for reads.                        |
| example            | The file documenting every configurable variable. Defaults to `.env.example`.                  |
| ambient            | Variables the runtime, bundler or CI supplies, never documented. Defaults cover Node and Vite. |
| externallyConsumed | Variables consumed outside the scanned sources, such as by a compose file. Defaults to none.   |
| reportUnread       | Whether to report documented variables that nothing reads. Defaults to `true`.                 |

## Detection

A read is direct property or index access on `process.env` and
`import.meta.env`, `Deno.env.get(...)`, `Bun.env.*`, an `env*("NAME")`
helper call, or destructuring from one of those objects. Comments are
masked through `vibator.text.maskComments` first, so prose naming a
variable does not count. In the example file, a live `NAME=value`, a
commented `# NAME=value`, and a name leading an aligned comment table
count as documented. `vibator-ignore env-example-sync` markers are honored
on the scanned sources at file level and on the example file at file and
line level.

## Diagnostics

One diagnostic per undocumented read, on the example file, and one per
documented variable nothing reads, on its line in the example file. When
the example file does not exist and the code reads non-ambient variables,
each read becomes a project-level diagnostic instead.

## Fix

Whether a variable belongs in the example file, in `ambient`, or in
`externallyConsumed` is the project's call. The rule implements no `fix`
hook.
