# The `biome` rule

This document is the reference of the `biome` rule: its options, the way it
selects files, the diagnostics it produces, and its fix behavior. The rule is
written against the [`vibator.biome` namespace](./biome-namespace.md).

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [File selection](#file-selection): The files the rule judges.
- [Diagnostics](#diagnostics): The mapping from Biome findings.
- [Errors](#errors): What happens when Biome cannot run.
- [Fix](#fix): What `vibator --write` applies.

---

## Configuration

The rule id is `biome`. Configure it in `.vibator.json`:

```json
{
  "plugins": [
    "@vibator/biome"
  ],
  "rules": {
    "biome": {
      "options": {
        "include": [
          "src/**/*.{ts,tsx,js,jsx,mjs,cjs}"
        ],
        "configPath": "biome.json"
      }
    }
  }
}
```

| Option              | Description                                                                                                                                                            |
|---------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| include / exclude   | The shared vibator scope globs selecting the files the rule judges.                                                                                                    |
| configPath?: string | Reference to a Biome configuration file: a `./` path from the project root, a `package:path` reference such as `@vibator/gate:biome.base.json`, or a package export. Defaults to `biome.json` or `biome.jsonc` at the root; Biome's defaults apply when neither exists. |
| config?: object     | A complete Biome configuration passed inline, taking precedence over `configPath` and the root files.                                                                  |

## File selection

The rule matches `include` and `exclude` against the files in scope for the
run, so `--staged`, `--changed`, and `--since` narrow the lint to exactly the
files they select. Files silenced by a `vibator-ignore-file biome` marker are
skipped, and findings on a line above a `vibator-ignore biome` marker are
dropped.

## Diagnostics

One diagnostic per reported Biome finding. Findings at Biome's `hint` and
`information` severities are skipped.

| Diagnostic field            | Value                                                                                                                                      |
|-----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| file, line, endLine, column | The finding's position, converted from Biome's byte spans.                                                                                 |
| message                     | The Biome description followed by the category, such as `(lint/style/useConst)`.                                                           |
| expected                    | "The code satisfies Biome check `<category>`".                                                                                             |
| fix                         | "Run vibator --write to apply Biome's safe fix" when the finding is safely fixable, otherwise a pointer to the Biome rule's documentation. |

## Errors

A configuration that fails to load (a `configPath` naming no file or an
uninstalled package, a file that fails to parse, or an `extends` entry that
fails to resolve) produces one project-level diagnostic instead of a
crash. A file Biome cannot process produces one diagnostic on that file and
the run continues.

## Fix

The rule implements vibator's `fix` hook. Under `vibator --write` it asks
Biome for each flagged file's content with safe fixes applied and writes it
back through `vibator.project.write`. The framework rechecks afterwards, so
findings whose fix Biome marks unsafe remain in the report.
