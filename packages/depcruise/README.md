# @vibator/depcruise

A [vibator](https://github.com/vibator/vibator) plugin that orchestrates
[dependency-cruiser](https://github.com/sverweij/dependency-cruiser) through
its JavaScript API (`cruise()`), never through a shell command.

Loading the plugin registers the `depcruise` rule, which cruises the
dependency graph and maps each ruleset violation to a vibator diagnostic,
and the `vibator.depcruise` subnamespace, the gateway other rules command
dependency-cruiser through.

## Setup

```json
// .vibator.json
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

| Option                | Description                                                                                                                                                  |
|-----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `configPath`          | Reference to a dependency-cruiser configuration file: a `./` path from the project root, a `package:path` reference such as `@vibator/gate:depcruise.cjs`, or a package export such as `@vibator/gate/depcruise`. When omitted, `.dependency-cruiser.{js,cjs,mjs,json}` at the root are used. |
| `config`              | Complete cruise options passed inline (a ruleset under `ruleSet`), taking precedence over `configPath` and the root files.                                   |
| `include` / `exclude` | The shared vibator scope globs selecting the files whose violations are reported.                                                                            |

A `configPath` that names no file is reported as a project-level finding
rather than crashing the run.

## Scoping

The files in scope become the cruise entry points, so `vibator --staged`,
`--changed`, and `--since` narrow the analysis: a cycle through a changed
file is reachable from it, so it is found. Orphan and reachability rules need
the full graph; the cruise then starts from the project root and only the
report narrows. `vibator-ignore depcruise` / `vibator-ignore-file depcruise`
markers are honored.

## Diagnostic mapping

| dependency-cruiser                   | vibator                                                                       |
|--------------------------------------|-------------------------------------------------------------------------------|
| `from` module                        | `file`, with `line` located at the import statement that pulls in the target  |
| `from` -> `to` and the rule name     | `message`, with the cycle route appended for circular violations              |
| the ruleset's `comment` for the rule | `expected`                                                                    |
| (architectural)                      | `fix` ("Restructure the dependency so the rule holds, or adjust the ruleset") |

Violations at the ruleset's `info` and `ignore` severities are skipped.

## Fixing

Dependency violations are architectural: resolving one means moving code or
changing the ruleset, and neither is a safe mechanical edit. The rule
implements no `fix` hook, so `vibator --write` leaves its findings for a
human.

## The `vibator.depcruise` namespace

Other rules can command dependency-cruiser through the registered namespace:

```ts
import type {DepcruiseNamespace} from "@vibator/depcruise";
import {vibator as base} from "vibator";

const vibator = base as typeof base & { depcruise: DepcruiseNamespace };

vibator.depcruise.configFile({configPath});        // the resolved configuration file
await vibator.depcruise.needsFullGraph({});          // orphan or reachability rules?
await vibator.depcruise.violations(entries, {});     // DepcruiseViolation[]
```

The resolved cruise options are loaded once per configuration and reused
across calls.

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
