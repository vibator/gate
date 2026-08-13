# @vibator/gate

The shared tool presets of the [vibator](https://github.com/vibator/vibator)
gate: one base configuration per tool, exported under a stable subpath.
Projects extend them from thin local files.

| Export                    | File              | Purpose                                        |
|---------------------------|-------------------|------------------------------------------------|
| `@vibator/gate/biome`     | `biome.base.json` | The Biome preset; editors extend it too.       |
| `@vibator/gate/depcruise` | `depcruise.cjs`   | The universal dependency ruleset.              |
| `@vibator/gate/tsconfig`  | `tsconfig.json`   | Compiler strictness a `tsconfig.json` extends. |

## Setup

Run the wizard; it writes the `.vibator.json`, the thin configuration files
under `.vibator/`, and the devDependencies:

```sh
npx @vibator/create-gate
```

Or wire a preset by hand:

```json
// .vibator/biome.json
{
  "extends": ["@vibator/gate/biome"]
}
```

```json
// .vibator.json
{
  "rules": {
    "biome": { "options": { "configPath": ".vibator/biome.json" } }
  }
}
```

Project rules go in the thin files, in the tool's own language.

## Design

The design doc under [docs/design/](./docs/design/) is the reference and
the contract: the presets it ships and how projects extend them.

## License

[MIT](../../LICENSE)
