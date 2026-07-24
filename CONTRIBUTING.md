# Contributing to the vibator gate

Thanks for contributing. This document is for humans; agents working in this
repository additionally follow [CLAUDE.md](./CLAUDE.md), and the design
invariants listed there bind all contributions. Participation is governed by
the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Setup

```sh
npm install
npm run verify    # everything CI runs: lint, arch, knip, build, test, dogfood
```

| Step              | Tool                         | Checks                                              |
|-------------------|------------------------------|-----------------------------------------------------|
| `npm run lint`    | Biome (strict, `biome.json`) | Formatting, lint rules, complexity limits           |
| `npm run arch`    | dependency-cruiser           | Package boundaries and cycles                       |
| `npm run knip`    | knip                         | Dead code, unused exports and dependencies          |
| `npm run build`   | tsc, per workspace           | Type errors in the wizard                           |
| `npm run test`    | vitest                       | Unit tests, with coverage                           |
| `npm run vibator` | vibator                      | The repository's own rules, via the preset it ships |

Requirements: Node 22 or later (see `.nvmrc`). Any package manager works,
but CI and the lockfile use npm. `npm run format` applies Biome's
formatting.

## Git hooks

`npm install` installs the hooks (husky):

- **pre-commit**: Biome on staged files, plus vibator's fast rules on the
  same scope.
- **commit-msg**: commitlint, because the commit type determines the release
  bump.
- **pre-push**: the full `npm run verify`.

## Commits

Conventional Commits, enforced locally and in CI. Releases are cut by
semantic-release from the commit history; both packages release in lockstep
with one version:

- `fix:` patch, `feat:` minor, `feat!:` or `BREAKING CHANGE:` major.
- `docs:`, `chore:`, `test:`, `refactor:` produce no release.

Write the subject line for the changelog reader, not the diff reader.

## Style

- Biome owns formatting and general lint (cognitive complexity at most 8,
  functions at most 25 lines, files at most 400 lines, no stray `console`).
- dependency-cruiser keeps the two packages independent: the wizard never
  imports `@vibator/gate`.
- knip keeps exports and dependencies in use or gone.
- The repository checks itself via `vibator.json`, which extends the preset
  in `packages/gate`: TSDoc on every declaration, meaningful names, no
  deprecated APIs.

Documentation and user-visible strings (CLI output, prompts, findings)
are direct and plain: one job per sentence, no em-dashes, no marketing.

If `npm run verify` passes, the style is right. Do not argue with a check in
a pull request; open an issue about the rule instead.

## Pull requests

Keep them scoped to one change. Fill in the template, including the local
verification checklist. CI runs the same `verify` chain plus commit linting.
A pull request merges with a green run and a review.
