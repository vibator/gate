# @vibator/biome

A [vibator](https://github.com/vibator/vibator) plugin that orchestrates
[Biome](https://biomejs.dev) through its JavaScript SDK.

Loading the plugin registers the `biome` rule and the
`vibator.biome` subnamespace.

## Setup

```shell
npm install --save-dev @vibator/biome
```

Add it to your `.vibator.json` configuration:

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
        ]
      }
    }
  }
}
```

## Options

| Option                | Description                                                                                                                                                                                                                                                                                                        |
|-----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `configPath`          | Reference to a Biome configuration file: a `./` path from the project root, a `package:path` reference such as `@vibator/gate:biome.base.json`, or a package export such as `@vibator/gate/biome`. When omitted, `biome.json` then `biome.jsonc` at the root are used; Biome's defaults apply when neither exists. |
| `config`              | A complete Biome configuration object passed inline, taking precedence over `configPath` and the root files.                                                                                                                                                                                                       |
| `include` / `exclude` | The shared vibator scope globs selecting the files the rule judges.                                                                                                                                                                                                                                                |

This rule supports vibator's `fix` hook by running: `vibator --write` .

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
