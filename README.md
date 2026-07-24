# @vibator/gate

A create script that bootstraps guard rails for vibe coders. One guided
run sets up Biome, knip, dependency-cruiser and
[vibator](https://github.com/vibator/vibator), and the package carries the
shared configurations that projects extend.

```sh
npm create @vibator/gate
```

Two packages, released together:

| Package                                          | What it is                                 |
|--------------------------------------------------|--------------------------------------------|
| [`@vibator/gate`](./packages/gate)               | The shared configurations projects extend  |
| [`@vibator/create-gate`](./packages/create-gate) | The wizard that sets a repository up       |

## How it works

The wizard walks numbered steps, one per tool. Each step shows what the
tool is for, the exact changes as a diff, and the warnings. Say yes and
the step is applied. Follow-ups such as `biome migrate` or replacing a
taken npm script run only if you say yes to them too.

## How it stays current

The wizard holds no configuration content. It writes thin configs that
extend `@vibator/gate` and installs each tool as a devDependency. To
update the standards, bump `@vibator/gate`.

## What it never does

- Overwrite or delete an existing configuration. Existing configs get an
  `extends` entry, existing hooks get the missing lines, everything else
  stays yours.
- Impose an orchestrator. It suggests a `verify` npm script; how you chain
  the tools is your call.
- Hang without a terminal. Every prompt has a flag, so scripts can run
  it end to end.

## Work on this repository

```sh
npm install
npm run verify
```

See [CONTRIBUTING.md](./CONTRIBUTING.md). The repository checks itself
with the presets it publishes.
