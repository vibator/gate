# @vibator/depcruise

A [vibator](https://github.com/vibator/vibator) plugin that orchestrates
[dependency-cruiser](https://github.com/sverweij/dependency-cruiser) through
its JavaScript API.

## Setup

## Setup

```shell
npm install --save-dev @vibator/depcruiser
```

Add it to your `.vibator.json` configuration:

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
        ]
      }
    }
  }
}
```

## Options

| Option                | Description                                                                                                                                                                                                                                                                                   |
|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `configPath`          | Reference to a dependency-cruiser configuration file: a `./` path from the project root, a `package:path` reference such as `@vibator/gate:depcruise.cjs`, or a package export such as `@vibator/gate/depcruise`. When omitted, `.dependency-cruiser.{js,cjs,mjs,json}` at the root are used. |
| `config`              | Complete cruise options passed inline (a ruleset under `ruleSet`), taking precedence over `configPath` and the root files.                                                                                                                                                                    |
| `include` / `exclude` | The shared vibator scope globs selecting the files whose violations are reported.                                                                                                                                                                                                             |

## Scoping

The files in scope become the cruise entry points, so `vibator --staged`,
`--changed`, and `--since` can be use to narrow the analysis.

Orphan and reachability rules need the full graph; the cruise then starts
from the project root and only the report narrows.

## The `vibator.depcruise` namespace

Other rules can command dependency-cruiser through the registered namespace:

```ts
import type {DepcruiseNamespace} from "@vibator/depcruise";
import {vibator as base} from "vibator";

const vibator = base as typeof base & { depcruise: DepcruiseNamespace };

vibator.depcruise.configFile({configPath});        // the resolved configuration file
await vibator.depcruise.needsFullGraph({});        // orphan or reachability rules?
await vibator.depcruise.violations(entries, {});   // DepcruiseViolation[]
```

## Design

The design docs are the reference and the contract.

| Document                                                       | Covers                                                               |
|----------------------------------------------------------------|----------------------------------------------------------------------|
| [depcruise-namespace.md](./docs/design/depcruise-namespace.md) | The `vibator.depcruise` subnamespace: functions, options, violations |
| [depcruise-rule.md](./docs/design/depcruise-rule.md)           | The `depcruise` rule: configuration, scoping, diagnostics            |

The rule's guideline, shown with every finding, lives at
[docs/rules/depcruise.md](./docs/rules/depcruise.md).

## License

[MIT](../../LICENSE)
