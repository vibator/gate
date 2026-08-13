# The `@vibator/create-gate` package

This document is the reference of the `@vibator/create-gate` package: the
wizard that sets the vibator gate up in a project.

## Reference

- [What the package is](#what-the-package-is): One command, a configured project.
- [The prompts](#the-prompts): What the wizard asks.
- [The generated files](#the-generated-files): What each answer produces.
- [Guards](#guards): What the wizard refuses.
- [Layout](#layout): The modules and their roles.

---

## What the package is

`npx @vibator/create-gate` turns an empty project into one gated by
vibator. The wizard asks which gates the project wants, writes the
`.vibator.json`, the thin tool configurations under `.vibator/`, and the
devDependencies into `package.json`. It does not run the install; the outro
tells the user to.

The generated configuration is explicit: every enabled plugin and rule is
visible in the project's own files. Tool customization happens in the thin
files under `.vibator/`, in each tool's own language, extending the
`@vibator/gate` presets.

## The prompts

| Prompt                                            | Kind        | Default                                   |
|---------------------------------------------------|-------------|-------------------------------------------|
| Which gates do you want?                          | multiselect | all four                                  |
| Create a tsconfig.json extending the gate preset? | confirm     | asked only when no `tsconfig.json` exists |

The gates are Biome (format and lint), Knip (unused code and dependencies),
dependency-cruiser (dependency graph rules), and the recommended
general-purpose rules.

## The generated files

| Answer             | File                     | Content                                                   |
|--------------------|--------------------------|-----------------------------------------------------------|
| always             | `.vibator.json`          | The chosen plugins and rules.                             |
| Biome              | `.vibator/biome.json`    | `{ "extends": ["@vibator/gate/biome"] }`                  |
| dependency-cruiser | `.vibator/depcruise.cjs` | `module.exports = { extends: "@vibator/gate/depcruise" }` |
| tsconfig           | `tsconfig.json`          | `{ "extends": "@vibator/gate/tsconfig" }`                 |

Knip needs no file: zero-config discovery is the preset.

In `.vibator.json`, the `biome` and `depcruise` rules point their
`configPath` at the thin files. The recommended rules carry the gate's
default scopes: `tsdoc-coverage`, `meaningful-names`,
`prefer-array-methods`, `no-deprecated-apis`, and `env-example-sync` over
`src/`, `no-conflict-markers` and `no-dead-doc-links` everywhere. The
configuration files live under `.vibator/` because the vibator rule loader
imports only `.ts`, `.js`, and `.mjs` modules from that folder; the
depcruise file stays `.cjs` for that reason.

The devDependencies added are `vibator`, one `@vibator/*` plugin per chosen
gate, and `@vibator/gate` when one of its presets is referenced. A version
already declared in the project is kept. The version ranges come from this
package's own `peerDependencies`, where they are declared optional so an
`npx` run does not install them.

## Guards

- No `package.json` at the root: the wizard cancels and asks for `npm init`.
- A `.vibator.json` already exists: the wizard cancels; it does not merge.
- A `tsconfig.json` already exists: the tsconfig prompt is skipped and the
  file is left alone.
- A planned file already exists: the run stops before writing anything.

## Layout

| Module         | Role                                                              |
|----------------|-------------------------------------------------------------------|
| `src/plan.ts`  | Pure: turns the answers into the files and dependencies to write. |
| `src/apply.ts` | Writes a plan to disk and edits `package.json`.                   |
| `src/cli.ts`   | The binary: the `@clack/prompts` flow around `plan` and `apply`.  |

The package is not a vibator plugin: it registers no namespace and no rule,
so it does not follow the namespace and rules layout of the plugin
packages.
