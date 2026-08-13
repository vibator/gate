# The `depcruise` rule

This document is the reference of the `depcruise` rule: its options, the way
the cruise is scoped, and the diagnostics it produces. The rule is written
against the [`vibator.depcruise` namespace](./depcruise-namespace.md).

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [Scoping](#scoping): The entry points the cruise starts from.
- [Diagnostics](#diagnostics): The mapping from violations.
- [Errors](#errors): What happens when the cruiser cannot run.
- [Fix](#fix): Why there is none.

---

## Configuration

The rule id is `depcruise`. Configure it in `.vibator.json`:

```json
{
  "plugins": [
    "@vibator/depcruise"
  ],
  "rules": {
    "depcruise": {
      "options": {
        "include": [
          "src/**/*.ts"
        ],
        "configPath": ".dependency-cruiser.cjs"
      }
    }
  }
}
```

| Option              | Description                                                                                                                                       |
|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| include / exclude   | The shared vibator scope globs selecting the files whose violations are reported.                                                                 |
| configPath?: string | Reference to a dependency-cruiser configuration file: a `./` path from the project root, a `package:path` reference such as `@vibator/gate:depcruise.cjs`, or a package export. Defaults to `.dependency-cruiser.{js,cjs,mjs,json}` at the root. |
| config?: object     | Complete cruise options passed inline (a ruleset under `ruleSet`), taking precedence over `configPath` and the root files.                        |

## Scoping

The files in scope become the cruise entry points, so `--staged`,
`--changed`, and `--since` narrow the analysis: a cycle through a changed
file is reachable from it, so it is found. Orphan and reachability rules need
the full graph; the cruise then starts from the project root and only the
report narrows. Violations at the ruleset's `info` and `ignore` severities
are skipped, only violations starting from a file in scope are reported, and
`vibator-ignore depcruise` markers are honored at file and line level.

## Diagnostics

One diagnostic per reported violation.

| Diagnostic field | Value                                                                                                                                                                           |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| file             | The module the dependency starts from.                                                                                                                                          |
| line             | The line of the import statement that pulls in the target, located by matching the target's basename in import and require specifiers; absent when no unambiguous match exists. |
| message          | "Dependency `<from>` -> `<to>` violates `<rule>`", with the cycle route appended for circular violations.                                                                       |
| expected         | The ruleset's `comment` for the rule, or "The dependency graph satisfies the `<rule>` rule".                                                                                    |
| fix              | "Restructure the dependency so the rule holds, or adjust the ruleset".                                                                                                          |

## Errors

A `configPath` naming no file or an uninstalled package produces one
project-level diagnostic instead of a crash.

## Fix

Dependency violations are architectural: resolving one means moving code or
changing the ruleset, and neither is a safe mechanical edit. The rule
implements no `fix` hook, so `vibator --write` leaves its findings for a
human.
