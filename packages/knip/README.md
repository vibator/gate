# @vibator/knip

A [vibator](https://github.com/vibator/vibator) plugin that orchestrates
[Knip](https://knip.dev) through its programmatic API, never through a shell
command.

Loading the plugin registers the `knip` rule, which analyzes the workspace
and maps each Knip issue to a vibator diagnostic, and the `vibator.knip`
subnamespace, the gateway other rules command Knip through.

## Setup

```json
// .vibator.json
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

## Options

| Option       | Description                                                                                                                                                                              |
|--------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `configPath` | Reference to a Knip configuration file: a `./` path from the project root or a `package:path` reference. When omitted, Knip discovers its own configuration (`knip.json`, `knip.ts`, the `knip` field in `package.json`, ...). |

The rule takes no `include`/`exclude` globs: Knip analyzes the whole
workspace because unused-ness is a global property. A `configPath` that names
no file is reported as a project-level finding rather than crashing the run.

## Scoping

Knip runs once; the rule then narrows the report to the files in scope, so
`vibator --staged`, `--changed`, and `--since` work the same way they do for
per-file rules. `vibator-ignore knip` / `vibator-ignore-file knip` markers
are honored.

## Diagnostic mapping

Each issue is worded per bucket, and every message carries the bucket as
`(knip/<bucket>)`:

| Knip bucket                       | message                                                  |
|-----------------------------------|----------------------------------------------------------|
| `files`                           | "This file is unused: nothing in the project imports it" |
| `dependencies`, `devDependencies` | "The dependency ... is unused"                           |
| `unlisted`, `binaries`            | "... is used but not listed in package.json"             |
| `unresolved`                      | "The import ... does not resolve"                        |
| `exports`, `types`                | "The export ... is unused"                               |
| `enumMembers`, `classMembers`     | "The member ... is unused"                               |
| `duplicates`                      | "The export ... is duplicated"                           |

## Fixing

The rule implements vibator's `fix` hook: `vibator --write` reruns Knip in
fix mode, stripping unused exports and types and removing unused dependencies
from `package.json`. Knip writes the files itself; the framework then
rechecks and reports only what remains.

## The `vibator.knip` namespace

Other rules can command Knip through the registered namespace:

```ts
import type {KnipNamespace} from "@vibator/knip";
import {vibator as base} from "vibator";

const vibator = base as typeof base & { knip: KnipNamespace };

vibator.knip.configFile({configPath});   // the resolved configuration file
await vibator.knip.issues({configPath}); // KnipIssue[] across all buckets
await vibator.knip.fix({configPath});    // apply Knip's fixes
```

One analysis runs per configuration and is reused across calls; a `fix` call
invalidates it.

## Design

The design docs are the reference and the contract.

| Document                                             | Covers                                                             |
|------------------------------------------------------|--------------------------------------------------------------------|
| [knip-namespace.md](./docs/design/knip-namespace.md) | The `vibator.knip` subnamespace: functions, options, issues        |
| [knip-rule.md](./docs/design/knip-rule.md)           | The `knip` rule: configuration, scoping, diagnostics, fix behavior |

The rule's guideline, shown with every finding, lives at
[docs/rules/knip.md](./docs/rules/knip.md).

## License

[MIT](../../LICENSE)
