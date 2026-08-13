# The `@vibator/gate` package

This document is the reference of the `@vibator/gate` package: the shared
tool presets of the gate and the way projects extend them.

## Reference

- [What the package is](#what-the-package-is): Presets only, no code.
- [Layout and exports](#layout-and-exports): The files it ships.
- [The tool presets](#the-tool-presets): Biome, dependency-cruiser, tsconfig.
- [Using the presets](#using-the-presets): Thin project files that extend them.
- [Dependency policy](#dependency-policy): Why the package depends on nothing.
- [Differences from the published gate](#differences-from-the-published-gate): What changes.

---

## What the package is

A pure preset package. It ships one base configuration per tool and exports
each under a stable subpath. It carries no code, no vibator configuration,
and no dependencies.

Projects do not extend the gate at the vibator level. The
`@vibator/create-gate` wizard generates the project's `.vibator.json` and a
`.vibator/` folder with one thin configuration per chosen tool, each
extending the matching preset here. A project can write the same files by
hand.

## Layout and exports

| File              | Export        | Purpose                                                             |
|-------------------|---------------|---------------------------------------------------------------------|
| `biome.base.json` | `./biome`     | The Biome preset the `biome` rule runs with; editors extend it too. |
| `depcruise.cjs`   | `./depcruise` | The universal dependency ruleset the `depcruise` rule runs with.    |
| `tsconfig.json`   | `./tsconfig`  | Compiler strictness preset a project `tsconfig.json` extends.       |

There is no Knip preset file: Knip's zero-config discovery is the preset,
and its own configuration has no extends mechanism. A project that needs
Knip settings writes a plain `knip.json`, which Knip discovers.

## The tool presets

`biome.base.json`:

| Setting                          | Value                                                |
|----------------------------------|------------------------------------------------------|
| vcs                              | git, `useIgnoreFile` on                              |
| formatter                        | spaces, width 2                                      |
| linter preset                    | `recommended`                                        |
| `noExcessiveCognitiveComplexity` | error, max 8                                         |
| `noExcessiveLinesPerFunction`    | error, max 25, blank lines skipped                   |
| `noExcessiveLinesPerFile`        | error, max 400                                       |
| `noConsole`                      | error, `warn` and `error` allowed                    |
| assist                           | `organizeImports` on                                 |
| overrides                        | the three size caps off in `*.test.*` and `*.spec.*` |

`depcruise.cjs`. Layer boundaries stay project-specific; these are the
universal rules:

| Rule                  | Severity | Enforces                                                            |
|-----------------------|----------|---------------------------------------------------------------------|
| `no-circular`         | error    | No dependency cycles.                                               |
| `no-test-deps-in-src` | error    | Production code does not import test files.                         |
| `not-to-unresolvable` | error    | Every import resolves.                                              |
| `no-non-package-json` | error    | No dependency outside `package.json`.                               |
| `not-to-dev-dep`      | error    | `src/` does not rely on devDependencies; type-only imports allowed. |
| `no-orphans`          | warn     | A module nothing imports is dead or missing its wiring.             |

`tsconfig.json`: `strict`, `noUncheckedIndexedAccess`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`, `isolatedModules`,
`forceConsistentCasingInFileNames`, `skipLibCheck`.

## Using the presets

A project extends each preset with a thin file in the tool's own language
and points the matching rule at it.

```json
// .vibator/biome.json
{
  "extends": ["@vibator/gate/biome"]
}
```

```js
// .vibator/depcruise.cjs
module.exports = {
  extends: "@vibator/gate/depcruise",
};
```

```json
// .vibator.json, the rules entries
{
  "rules": {
    "biome": { "options": { "configPath": ".vibator/biome.json" } },
    "depcruise": { "options": { "configPath": ".vibator/depcruise.cjs" } }
  }
}
```

```json
// tsconfig.json
{
  "extends": "@vibator/gate/tsconfig"
}
```

Project rules go in the thin files, in the tool's language: Biome rules
under `linter.rules`, dependency-cruiser layer boundaries under
`forbidden`. The `biome` rule flattens the extends chain itself, so the run
and the editor enforce the same configuration; dependency-cruiser resolves
its own `extends` natively.

The vibator rule loader imports only `.ts`, `.js`, and `.mjs` modules from
the `.vibator/` folder, so the configuration files live there without being
loaded as rules. The depcruise file stays `.cjs` for that reason.

A project that wants a preset with no local file points `configPath`
straight into the package: `"@vibator/gate:biome.base.json"` or
`"@vibator/gate:depcruise.cjs"`.

## Dependency policy

The package has no dependencies. Nothing imports it as code: the plugins
read its files, and the tools resolve its exports.

- The `@vibator/create-gate` wizard installs `vibator` and the chosen
  plugins as devDependencies of the project, so a project carries only the
  tools it enabled.
- Each plugin carries its tool as a regular dependency. The tool's
  JavaScript API is not a stable contract, so only the pair the plugin was
  tested against is known to work; a project that must run a different tool
  version forces it with npm `overrides`.

## Differences from the published gate

| Published gate                                                 | This package                                                                              |
|----------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| Ships a vibator rules preset alongside the tool presets.       | Presets only; the `@vibator/create-gate` wizard writes the project's `.vibator.json`.     |
| Four tools run through four npm scripts, chained by `verify`.  | One `npx vibator` run covers every enabled tool through the `@vibator/*` plugins.         |
| `max-file-size` at error, 400 kB.                              | Dropped.                                                                                  |
| Biome, depcruise, and tsconfig presets.                        | Carried unchanged, exported under the same subpaths.                                      |
