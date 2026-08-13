# @vibator/biome

A [vibator](https://github.com/vibator/vibator) plugin that orchestrates the
[Biome](https://biomejs.dev) linter through its JavaScript SDK
(`@biomejs/js-api`), never through a shell command.

Loading the plugin registers the `biome` rule, which lints every file in
scope and maps each Biome diagnostic to a vibator diagnostic, and the
`vibator.biome` subnamespace, the gateway other rules command Biome
through.

## Setup

```json
// .vibator.json
{
  "plugins": [
    "@vibator/biome"
  ],
  "rules": {
    "biome": {
      "options": {
        "include": [
          "src/**/*.{ts,tsx,js,jsx,mjs,cjs}"
        ]
      }
    }
  }
}
```

## Options

| Option                | Description                                                                                                                                                                         |
|-----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `configPath`          | Reference to a Biome configuration file: a `./` path from the project root, a `package:path` reference such as `@vibator/gate:biome.base.json`, or a package export such as `@vibator/gate/biome`. When omitted, `biome.json` then `biome.jsonc` at the root are used; Biome's defaults apply when neither exists. |
| `config`              | A complete Biome configuration object passed inline, taking precedence over `configPath` and the root files.                                                                        |
| `include` / `exclude` | The shared vibator scope globs selecting the files the rule judges.                                                                                                                 |

The configuration file may extend others, by relative path or package
specifier such as `@vibator/gate/biome`; the plugin resolves and flattens
the chain itself with Biome's merge semantics, since the Biome workspace
does not resolve `extends`.

A `configPath` that names no file, or a configuration that fails to parse, is
reported as a project-level finding rather than crashing the run.

## Diagnostic mapping

| Biome                      | vibator                                                                    |
|----------------------------|----------------------------------------------------------------------------|
| byte span                  | `line`, `endLine`, `column` (UTF-8 spans converted to code-unit positions) |
| `description` + `category` | `message`                                                                  |
| category                   | `expected` ("The code satisfies Biome check ...")                          |
| safe fix availability      | `fix` ("Run vibator --write ..." or a link to the Biome rule docs)         |

Findings at Biome's `hint` and `information` severities are skipped, and
`vibator-ignore biome` / `vibator-ignore-file biome` markers are honored.

## Fixing

The rule implements vibator's `fix` hook: `vibator --write` asks Biome for the
file content with **safe fixes** applied (`fixFileMode: "safeFixes"`) and
writes it back through `vibator.project.write`. The framework then rechecks
and reports only what remains; findings whose fix Biome marks unsafe stay for
a human.

## The `vibator.biome` namespace

Other rules can command Biome through the registered namespace:

```ts
import type {BiomeNamespace} from "@vibator/biome";
import {vibator as base} from "vibator";

const vibator = base as typeof base & { biome: BiomeNamespace };

vibator.biome.configFile({configPath});  // the resolved configuration file
vibator.biome.lint(file, {configPath});  // BiomeFinding[] with positions
vibator.biome.fix(file, {config});       // content with safe fixes applied
```

One Biome workspace is created per configuration and reused across calls.

## Design

The design docs are the reference and the contract.

| Document                                               | Covers                                                         |
|--------------------------------------------------------|----------------------------------------------------------------|
| [biome-namespace.md](./docs/design/biome-namespace.md) | The `vibator.biome` subnamespace: functions, options, findings |
| [biome-rule.md](./docs/design/biome-rule.md)           | The `biome` rule: configuration, diagnostics, fix behavior     |

The rule's guideline, shown with every finding, lives at
[docs/rules/biome.md](./docs/rules/biome.md).

## License

[MIT](../../LICENSE)
