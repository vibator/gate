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
`.vibator.json`, the thin tool configurations under `.vibator/`, and adds the
devDependencies into `package.json`.

The generated configuration is explicit: every enabled plugin and rule is
visible in the project's own files. Tool customization happens in the thin
files under `.vibator/`, in each tool's own language, extending the
`@vibator/gate` presets.

> [!NOTE]
> Knip needs no file: zero-config discovery is the preset.

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
