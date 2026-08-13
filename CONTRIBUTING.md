# Contributing to vibator-plugins

Thanks for contributing. This document is for humans. Agents working in this
repository also follow [CLAUDE.md](./CLAUDE.md), and the invariants listed
there bind all contributions. Participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Setup

```sh
npm install
npm run verify    # the whole gate: lint, arch, knip, typecheck, test
```

`verify` runs the whole gate:

| Step                 | Tool                         | Checks                                        |
|----------------------|------------------------------|-----------------------------------------------|
| `npm run lint`       | Biome (strict, `biome.json`) | Formatting, lint rules, complexity limits     |
| `npm run arch`       | dependency-cruiser           | Cycles across the packages' source            |
| `npm run knip`       | knip                         | Dead code, unused exports and dependencies    |
| `npm run typecheck`  | tsc                          | Type errors                                   |
| `npm run test`       | vitest                       | The plugin tests, with coverage               |

Requirements: Node 24 or later (see `.nvmrc`). Any package manager works, but
CI and the lockfile use npm. Node runs the TypeScript source directly through
type stripping, so there is no build step. `npm run format` applies Biome's
formatting.

Tests build throwaway projects under the system temp directory, with the
workspace `node_modules` linked in. No test depends on files at the
repository root.

## Git hooks

`npm install` installs the hooks (husky):

- **pre-commit**: Biome on the staged files.
- **commit-msg**: commitlint. The commit type sets the release bump.
- **pre-push**: the full `npm run verify`.

## Commits

Conventional Commits, enforced locally and in CI. semantic-release cuts each
package's releases from the commit history, so the type you choose is the
version bump you cause:

- `fix:` patch, `feat:` minor, `feat!:` or `BREAKING CHANGE:` major.
- `docs:`, `chore:`, `test:`, `refactor:` produce no release.

Releases are per package:
[semantic-release-monorepo](https://github.com/pmowrer/semantic-release-monorepo)
counts only the commits that touch a package's files. Keep a commit scoped to
one package.

Dependabot follows the same rules: a production dependency bump commits as
`fix(deps)` and patch-releases the plugins that carry the updated tools, a
devDependency bump commits as `chore(deps)` and releases nothing.

Write the subject line for the changelog reader, not the diff reader.

## Changing behavior

Each package is a vibator plugin with two layers: a subnamespace that gates
one tool's JavaScript API, and a rule written against that subnamespace. Read
the package's `docs/design/` before changing behavior, and update the design
doc in the same change as the code. The design choices, in summary:

- A tool is driven through its JavaScript API, never through a shell command.
- The subnamespace is the only module that imports the tool.
- A broken tool configuration becomes a project-level diagnostic, not a crash.
- Diagnostics honor `vibator.ignore` markers at file and line level.

## Style

- Biome owns formatting and lint.
- dependency-cruiser keeps the dependency graph free of cycles.
- knip keeps exports and dependencies in use or gone.

Documentation and user-visible strings (rule messages, `fix` texts) use plain,
direct language.

If `npm run verify` passes, the style is right. Do not argue with a check in a
pull request; open an issue instead.

## Pull requests

Keep them scoped to one change. CI runs the same `verify` chain plus commit
linting. A pull request merges with a green run and a review from a main
contributor.
