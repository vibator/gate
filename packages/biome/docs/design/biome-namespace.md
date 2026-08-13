# `vibator.biome` namespace

This document is the reference of the `biome` subnamespace as
`@vibator/biome` registers it onto the shared `vibator` object.
Importing the package (or `src/namespace/biome.ts` directly) performs the
registration; rules then reach it as `vibator.biome`.

The subnamespace drives the Biome linter through its JavaScript SDK
(`@biomejs/js-api`).

## Reference

- [Functions](#functions): The calls the subnamespace exposes.
- [BiomeOptions](#biomeoptions): The options every call accepts.
- [BiomeFinding](#biomefinding): One finding with resolved positions.
- [Sessions](#sessions): How Biome workspaces are cached.

---

## Functions

| Declaration                                                                                | Description                                                                                                                                                                                     |
|--------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| configFile(options?: [BiomeOptions](#biomeoptions)): string \| undefined                   | The absolute path of the configuration file a run resolves, or undefined when an inline configuration or Biome's defaults apply. Throws when a configured path names no file or fails to parse. |
| lint(file: File, options?: [BiomeOptions](#biomeoptions)): [BiomeFinding](#biomefinding)[] | Lints a file and returns Biome's findings with positions resolved.                                                                                                                              |
| fix(file: File, options?: [BiomeOptions](#biomeoptions)): string                           | The file content with Biome's safe fixes applied; unchanged when nothing is fixable.                                                                                                            |

## BiomeOptions

The options every call accepts.

| Declaration            | Description                                                                                                                                                                                                   |
|------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| config?: Configuration | A complete Biome configuration passed programmatically. Takes precedence over `configPath` and the root configuration files.                                                                                  |
| configPath?: string    | Reference to a Biome configuration file: a `./` path from the project root, an absolute path, a `package:path` reference such as `@vibator/gate:biome.base.json`, or a package export such as `@vibator/gate/biome`. When omitted, `biome.json` then `biome.jsonc` at the project root are used, and Biome's defaults apply when neither exists. |

Configuration files may carry `.jsonc` comments; the namespace strips them
before parsing.

A configuration file may extend others. The namespace flattens the chain
before applying it, because the Biome workspace applies a configuration
object without resolving `extends`. An entry resolves from the file naming
it, through `vibator.module.resolve`: a `./` path, an absolute path, a
`package:path` reference, or a package specifier such as
`@vibator/gate/biome`. Files merge the way Biome's own extends does:
objects merge by key with the extending file winning, and `overrides`
entries concatenate.

## BiomeFinding

One Biome finding with its position resolved to line and column.

| Declaration                                                          | Description                                                  |
|----------------------------------------------------------------------|--------------------------------------------------------------|
| category?: string                                                    | The Biome category, such as `lint/style/useConst`.           |
| severity: "hint" \| "information" \| "warning" \| "error" \| "fatal" | The severity Biome assigns the finding.                      |
| description: string                                                  | The plain-text description of the finding.                   |
| line?: number                                                        | The 1-based line the finding starts on.                      |
| endLine?: number                                                     | The 1-based line the finding ends on, when it spans several. |
| column?: number                                                      | The 1-based column the finding starts on.                    |
| fixable: boolean                                                     | Whether Biome carries a safe fix for the finding.            |

Biome reports byte spans; the namespace converts UTF-8 byte offsets to
code-unit positions through `vibator.text.positionAt`. Fixability is derived
by comparing the diagnostics before and after a safe-fix pass on the file.

## Sessions

One Biome workspace is created per configuration (inline object or resolved
path) and reused across calls for the duration of the run.
