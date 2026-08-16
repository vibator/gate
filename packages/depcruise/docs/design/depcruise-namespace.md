# `vibator.depcruise` namespace

This document is the reference of the `depcruise` subnamespace as
`@vibator/depcruise` registers it onto the shared `vibator` object. Importing
the package performs the registration; rules then reach it as
`vibator.depcruise`.

The subnamespace drives dependency-cruiser through its JavaScript API
(`cruise()`).

## Reference

- [Functions](#functions): The calls the subnamespace exposes.
- [DepcruiseOptions](#depcruiseoptions): The options every call accepts.
- [DepcruiseViolation](#depcruiseviolation): One violation with resolved paths.
- [Caching](#caching): How loaded configurations are reused.

---

## Functions

| Declaration                                                                                                                          | Description                                                                                                                                                                            |
|--------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| configFile(options?: [DepcruiseOptions](#depcruiseoptions)): string \| undefined                                                     | The absolute path of the configuration file a run resolves, or undefined when an inline configuration applies or no configuration exists. Throws when a configured path names no file. |
| needsFullGraph(options?: [DepcruiseOptions](#depcruiseoptions)): Promise\<boolean\>                                                  | Whether the loaded ruleset contains rules that need the full module graph (orphan and reachability rules) rather than the graph reachable from a set of entry points.                  |
| violations(entries: string[], options?: [DepcruiseOptions](#depcruiseoptions)): Promise<[DepcruiseViolation](#depcruiseviolation)[]> | Cruises the dependency graph from the given absolute entry paths and returns every violation of the loaded ruleset, with module paths absolutized.                                     |

`node_modules` is never followed, and the cruise runs with the project root
as its base directory.

## DepcruiseOptions

The options every call accepts.

| Declaration             | Description                                                                                                                                                                                       |
|-------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| config?: ICruiseOptions | Complete cruise options passed programmatically (a ruleset under `ruleSet`). Takes precedence over `configPath` and the root configuration files.                                                 |
| configPath?: string     | Reference to a dependency-cruiser configuration file: a `./` path from the project root, an absolute path, a `package:path` reference such as `@vibator/gate:depcruise.cjs`, or a package export such as `@vibator/gate/depcruise`. When omitted, `.dependency-cruiser.js`, `.cjs`, `.mjs`, then `.json` at the project root are used. |

## DepcruiseViolation

One dependency-cruiser violation with resolved paths.

| Declaration                                       | Description                                                        |
|---------------------------------------------------|--------------------------------------------------------------------|
| rule: string                                      | The name of the violated rule.                                     |
| severity: "error" \| "warn" \| "info" \| "ignore" | The severity the ruleset assigns the rule.                         |
| from: string                                      | The absolute path of the module the dependency starts from.        |
| to: string                                        | The absolute path of the module the dependency points at.          |
| cycle?: string[]                                  | The module names along the cycle, when the violation is circular.  |
| comment?: string                                  | The explanation the ruleset carries for the rule, when one is set. |

## Caching

The resolved cruise options are loaded once per configuration path and reused
across calls for the duration of the run.
