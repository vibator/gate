# Contributing to vibator-plugins

Thanks for contributing. This document is for humans. Agents working in this
repository also follow [CLAUDE.md](./CLAUDE.md). Participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Setup

```sh
npm install
npm run verify    # the whole gate: lint, arch, knip, typecheck, test
```

`verify` fans out the following scripts:

| Step                 | Tool                         | Checks                                        |
|----------------------|------------------------------|-----------------------------------------------|
| `npm run lint`       | Biome (strict, `biome.json`) | Formatting, lint rules, complexity limits     |
| `npm run arch`       | dependency-cruiser           | Cycles across the packages' source            |
| `npm run knip`       | knip                         | Dead code, unused exports and dependencies    |
| `npm run typecheck`  | tsc                          | Type errors                                   |
| `npm run test`       | vitest                       | The plugin tests, with coverage               |

Requirements: Node 24 or later (see `.nvmrc`). Any package manager should work, but
CI and the lockfile use npm. Node runs the TypeScript source directly through
type stripping during development.

## Git hooks

Running `npm install` sets up the following hooks with husky:

- **pre-commit**: Biome on the staged files.
- **commit-msg**: commitlint.
- **pre-push**: the full `npm run verify` above.

## Commits

Conventional Commits are enforced locally via husky and in CI. Release notes are
generated from the commit history, so the type you choose is the version bump you cause:

- `fix` for a patch bump, `feat` for a minor bump and `feat!` or `BREAKING CHANGE:` (in the body)
  for a major bump.
- `docs:`, `chore:`, `test:`, `refactor:` produce no release.

## Style

For documentation and user facing strings use plain, direct language.

If `npm run verify` passes, the style is right. Do not argue with a check in a
pull request; open an issue instead.

## Pull requests

Please keep them scoped to a single change.

## Changing behavior

Read the package's `docs/design/` before changing its behavior, and update the design
doc in the same change as the code. The design choices, in summary:

- Tools are driven through their JavaScript API and not through shell commands.
- Pllugin gives access to their rules and the api (by extending the vibator namespace)
  so that clients can create custom rules.
- Diagnostics honor `vibator.ignore` markers at file and line level.
