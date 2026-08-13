# `vibator.knip` namespace

This document is the reference of the `knip` subnamespace as
`@vibator/knip` registers it onto the shared `vibator` object.
Importing the package (or `src/namespace/knip.ts` directly) performs the
registration; rules then reach it as `vibator.knip`.

The subnamespace drives Knip through its programmatic API (`knip` and
`knip/session`). Knip decides whether code is unused from the whole
workspace, so the namespace runs it once per configuration; callers
intersect the issues with the files in scope.

## Reference

- [Functions](#functions): The calls the subnamespace exposes.
- [KnipOptions](#knipoptions): The options every call accepts.
- [KnipIssue](#knipissue): One issue with its file and position.
- [Caching](#caching): How analyses are reused.

---

## Functions

| Declaration                                                                       | Description                                                                                                                                                |
|-----------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| configFile(options?: [KnipOptions](#knipoptions)): string \| undefined            | The absolute path of the configuration file a run uses, or undefined when Knip discovers its own. Throws when a configured path names no file.             |
| issues(options?: [KnipOptions](#knipoptions)): Promise<[KnipIssue](#knipissue)[]> | Analyzes the workspace and returns every issue Knip reports, flattened across Knip's buckets.                                                              |
| fix(options?: [KnipOptions](#knipoptions)): Promise\<void\>                       | Runs Knip with its fixes enabled: unused exports and types are stripped and unused dependencies removed from `package.json`. Knip writes the files itself. |

## KnipOptions

The options every call accepts.

| Declaration         | Description                                                                                                                                                                                          |
|---------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| configPath?: string | Reference to a Knip configuration file: a `./` path from the project root, an absolute path, or a `package:path` reference. When omitted, Knip discovers its own configuration (`knip.json`, `knip.ts`, the `knip` field in `package.json`, …). |

## KnipIssue

One Knip issue with its file and position.

| Declaration           | Description                                                          |
|-----------------------|----------------------------------------------------------------------|
| type: string          | The issue bucket, such as `exports`, `files`, or `dependencies`.     |
| filePath: string      | The absolute path of the file the issue points at.                   |
| symbol: string        | The symbol the issue is about: an export, a dependency, a specifier. |
| parentSymbol?: string | The enclosing symbol, for enum and class members.                    |
| line?: number         | The 1-based line, when Knip resolves a position.                     |
| col?: number          | The 1-based column, when Knip resolves a position.                   |
| fixable: boolean      | Whether Knip can remove the issue itself under a fix run.            |

The fixable buckets are `exports`, `types`, `dependencies`, and
`devDependencies`.

## Caching

One analysis runs per configuration path and is reused across calls for the
duration of the run. A `fix` call invalidates the cache, so the next `issues`
call reanalyzes.
