# Vibator Gate

<div align="center">
[![Quality](https://github.com/vibator/gate/actions/workflows/quality.yml/badge.svg)](https://github.com/vibator/gate/actions/workflows/quality.yml)
[![node](https://img.shields.io/node/v/@vibator/gate)](https://nodejs.org)
[![license: MIT](https://img.shields.io/npm/l/@vibator/gate)](./LICENSE)
</div>

This repository contains a collection of ready-to-use plugins and presets for
[vibator](https://github.com/vibator/vibator).

## Quick start

```sh
npx @vibator/create-gate
```

Follow the wizard and then install the packages with:

```sh
$ npm install
```

Plugins and rules configuration are written in the  `.vibator.json` file,
and each tool has its own configuration under `.vibator/` folder.

## Packages

| Package                                        | What it does                                                           |
|------------------------------------------------|------------------------------------------------------------------------|
| [`@vibator/biome`](packages/biome)             | The `biome` rule: format and lint through `@biomejs/js-api`.           |
| [`@vibator/knip`](packages/knip)               | The `knip` rule: unused code and dependencies through Knip's API.      |
| [`@vibator/depcruise`](packages/depcruise)     | The `depcruise` rule: dependency graph rules through `cruise()`.       |
| [`@vibator/recommended`](packages/recommended) | The recommended general-purpose rules, from conflict markers to TSDoc. |
| [`@vibator/gate`](packages/gate)               | The shared Biome, dependency-cruiser, and tsconfig presets.            |
| [`@vibator/create-gate`](packages/create-gate) | The wizard that writes the configuration and the dependencies.         |

## Why run tools through vibator?

Nothing forces you to, these tools run fine on their own, and you can keep them that way.

Running them through vibator changes three things:

- **One command, one report.** Every finding is risen from a single run , instead
  of a chain of npm scripts each with its own  format. The output is SARIF compatible,
  it integratew into the code-scanning and CI workflows you already have.
- **One entry point.** `.vibator.json` decides which tools run and at what
  severity. Their options can live inline or stay in the config files you
  already have.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md). Commits follow Conventional Commits.

## License

[MIT](./LICENSE)
