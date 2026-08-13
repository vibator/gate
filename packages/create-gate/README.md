# @vibator/create-gate

The wizard that sets the [vibator](https://github.com/vibator/vibator) gate
up in a project.

```sh
npx @vibator/create-gate
```

It asks which gates the project wants (Biome, Knip, dependency-cruiser, the
recommended rules) and writes:

- `.vibator.json` with the chosen plugins and rules.
- `.vibator/biome.json` and `.vibator/depcruise.cjs`, thin configurations
  extending the [`@vibator/gate`](../gate) presets. Project rules go in
  these files, in the tool's own language.
- `tsconfig.json` extending the gate preset, when asked and none exists.
- The devDependencies in `package.json`. The wizard edits the manifest and
  leaves the install to your package manager.

Existing files are never overwritten: the wizard refuses to run over a
`.vibator.json` and leaves an existing `tsconfig.json` alone.

## Design

The design doc under [docs/design/](./docs/design/) is the reference and
the contract: the prompts, the generated files, and the guards.

## License

[MIT](../../LICENSE)
