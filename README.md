<div align="center">
  <h1>Vibator Gate</h1>

[![Quality](https://github.com/vibator/gate/actions/workflows/quality.yml/badge.svg)](https://github.com/vibator/gate/actions/workflows/quality.yml)
[![npm version](https://img.shields.io/npm/v/@vibator/gate)](https://www.npmjs.com/package/@vibator/gate)
[![node](https://img.shields.io/node/v/@vibator/gate)](https://nodejs.org)
[![license: MIT](https://img.shields.io/npm/l/@vibator/gate)](./LICENSE)
</div>

The official [vibator](https://github.com/vibator/vibator) gate: plugins
that run Biome, Knip, and dependency-cruiser as vibator rules through their
JavaScript APIs, a set of recommended general-purpose rules, shared tool
presets, and the wizard that sets it all up. One `npx vibator` run covers
formatting, linting, dead code, the dependency graph, and your own
standards, and every finding carries the guideline that explains it.

## Install

```sh
npx @vibator/create-gate
```

The wizard asks which gates the project wants, writes the `.vibator.json`
and the thin tool configurations under `.vibator/`, and adds the
devDependencies. Install and run:

```sh
npm install
npx vibator
```

Vibator requires Node 24 or later. To skip the wizard, install the plugins
you want next to `vibator` and list them under `plugins` in
`.vibator.json`; each package README shows its setup.

## Packages

| Package                                        | What it does                                                              |
|------------------------------------------------|----------------------------------------------------------------------------|
| [`@vibator/biome`](packages/biome)             | The `biome` rule: format and lint through `@biomejs/js-api`.              |
| [`@vibator/knip`](packages/knip)               | The `knip` rule: unused code and dependencies through Knip's API.         |
| [`@vibator/depcruise`](packages/depcruise)     | The `depcruise` rule: dependency graph rules through `cruise()`.          |
| [`@vibator/recommended`](packages/recommended) | The recommended general-purpose rules, from conflict markers to TSDoc.    |
| [`@vibator/gate`](packages/gate)               | The shared Biome, dependency-cruiser, and tsconfig presets.               |
| [`@vibator/create-gate`](packages/create-gate) | The wizard that writes the configuration and the dependencies.            |

## Why

A gate made of separate tools is a chain of configs, scripts, and output
formats, and its standards never reach a coding agent as one signal. Here
every tool runs as a vibator rule: one command, one report, one ignore
mechanism, and `--staged`, `--changed`, and `--write` compose across all of
them. The tools are driven through their JavaScript APIs, never through a
shell command, so findings map to structured diagnostics with the guideline
attached. Project customization stays in each tool's own language: thin
configuration files extend the [`@vibator/gate`](packages/gate) presets.

## Design

Each package's README is the guide. Its `docs/design/` folder is the
reference and the contract: the subnamespace it registers, the rules it
defines, and the presets it ships.

## Development

```sh
npm install
npm run verify    # lint, arch, knip, typecheck, tests
```

The packages are plain erasable TypeScript; Node 24 runs them directly with
no build step. Tests build throwaway projects under the system temp
directory, so no test depends on files at the repository root.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md). Commits follow Conventional Commits.

## License

[MIT](./LICENSE)
