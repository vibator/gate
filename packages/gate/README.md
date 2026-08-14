# @vibator/gate

A set of shared tool presets of the [vibator](https://github.com/vibator/vibator)
gate.

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

```shell
npm install --save-dev @vibator/gate
```

On your `biome.json`:

```json
{
  "extends": ["@vibator/gate/biome"]
}
```

## Design

The design doc under [docs/design/](./docs/design/).

## License

[MIT](../../LICENSE)
