# @vibator/gate

The shared configurations behind the vibator gate. Projects extend them
from thin local configs, so updating the standards is a version bump.
[docs/standards.md](./docs/standards.md) explains each standard and the
failure it prevents.

Set a repository up with `npm create @vibator/gate`, or wire the extends
lines by hand as below.

## Install

```sh
npm install --save-dev @vibator/gate
```

Install the tools next to it as devDependencies: `@biomejs/biome`, `knip`,
`dependency-cruiser`, `vibator`, and `typescript` if the project uses it.
This package is data only. It imports nothing.

## The presets

**`biome.json`**

```json
{
  "extends": ["@vibator/gate/biome"]
}
```

Strict formatting and lint. Complexity at most 8, functions at most 25
lines, files at most 400 lines, no stray `console`. Test files are exempt
from the limits.

**`.dependency-cruiser.cjs`**

```js
module.exports = {
  extends: "@vibator/gate/depcruise",
  // Your layer boundaries go here; rules merge by name.
  forbidden: [],
  // In a TypeScript project, so aliased imports resolve:
  options: { tsConfig: { fileName: "tsconfig.json" } },
};
```

No cycles, no test imports in production code, no unresolvable imports,
no undeclared dependencies, no devDependencies in production code.
Orphans warn.

**`vibator.json`**

```json
{
  "$schema": "./node_modules/vibator/schema.json",
  "extends": ["@vibator/gate/vibator"]
}
```

TSDoc on every declaration, meaningful names, array methods over
single-statement loops, no deprecated APIs. Findings link to the
[standards document](./docs/standards.md).

**`tsconfig.json`**

```json
{
  "extends": "@vibator/gate/tsconfig"
}
```

Strictness flags only. Module, target and paths stay yours.

**commitlint** needs nothing from the gate. The wizard writes a plain
`.commitlintrc.json` extending `@commitlint/config-conventional`.

**knip** has no extends mechanism. Run it with its defaults.

## Scripts

The gate imposes no runner. Chain the tools however you like. A plain
starting point:

```json
{
  "scripts": {
    "verify": "biome check && knip && depcruise src --config .dependency-cruiser.cjs && vibator"
  }
}
```

## Agent guidance

`skills/using-the-vibator-gate/` is an agent skill: how to run the gate,
act on findings, and adjust standards in the thin configs. Copy the folder
into your agent's skills directory to install it. The wizard lists it, and
vibator's own skills, in the AGENTS.md section it writes.

## Adjusting standards

State the difference in your thin config. The preset stays shared.
[docs/standards.md](./docs/standards.md) shows how.
