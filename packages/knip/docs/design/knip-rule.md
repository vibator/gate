# The `knip` rule

This document is the reference of the `knip` rule: its options, the way it
narrows the report, and the diagnostics it produces. The rule is written
against the [`vibator.knip` namespace](./knip-namespace.md).

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [Scoping](#scoping): How the report narrows to the files in scope.
- [Diagnostics](#diagnostics): The mapping from Knip issues.
- [Errors](#errors): What happens when Knip cannot run.
- [Fix](#fix): What `vibator --write` applies.

---

## Configuration

The rule id is `knip`. Configure it in `.vibator.json`:

```json
{
  "plugins": [
    "@vibator/knip"
  ],
  "rules": {
    "knip": {
      "options": {
        "configPath": "./knip.json"
      }
    }
  }
}
```

| Option | Description |
|---|---|
| configPath?: string | Reference to a Knip configuration file: a `./` path from the project root or a `package:path` reference. When omitted, Knip discovers its own configuration. |

The rule takes no `include`/`exclude` globs: Knip decides whether code is
unused from the whole workspace, so it always analyzes all of it.

## Scoping

Knip runs once over the workspace; the rule then keeps only the issues that
land on files in scope for the run. `--staged`, `--changed`, and `--since`
therefore narrow the report the same way they do for per-file rules, without
changing the analysis. Files silenced by a `vibator-ignore-file knip` marker
are skipped, and issues on a line above a `vibator-ignore knip` marker are
dropped.

## Diagnostics

One diagnostic per reported issue, worded per bucket.

| Bucket | message |
|---|---|
| files | "This file is unused: nothing in the project imports it" |
| dependencies / devDependencies | "The dependency `<symbol>` is unused" |
| optionalPeerDependencies | "The optional peer dependency `<symbol>` is unused" |
| unlisted | "The dependency `<symbol>` is used but not listed in package.json" |
| binaries | "The binary `<symbol>` is used but its package is not listed" |
| unresolved | "The import `<symbol>` does not resolve" |
| exports / types | "The export `<symbol>` is unused" |
| enumMembers / classMembers | "The member `<parent>.<symbol>` is unused" |
| duplicates | "The export `<symbol>` is duplicated" |

Every message carries the bucket as `(knip/<bucket>)`, the `expected` field
states that Knip finds no unused or unresolved code, and the `fix` field says
whether `vibator --write` can resolve it or what to do by hand.

## Errors

A `configPath` naming no file produces one project-level diagnostic instead
of a crash.

## Fix

The rule implements vibator's `fix` hook. Under `vibator --write`, when the
report contains file-level findings, it reruns Knip in fix mode: unused
exports and types are stripped and unused dependencies removed from
`package.json`. The framework rechecks afterwards, so what Knip cannot fix
remains in the report.
