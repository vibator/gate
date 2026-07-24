# vibator gate agent guide

Read this fully before writing code here.

## What this is

A two-package npm workspace that brings any JavaScript or TypeScript
repository onto a strict shared quality gate built from Biome, knip,
dependency-cruiser and vibator.

- `packages/gate` (`@vibator/gate`): pure configuration data. Strict presets
  for Biome, dependency-cruiser, vibator and TypeScript, plus
  the guideline docs and agent skills that go with them. Zero runtime
  dependencies; consumers' thin configs extend these files through the
  package `exports`.
- `packages/create-gate` (`@vibator/create-gate`): the wizard behind
  `npm create @vibator/gate`. Detection plus pointers plus installs; it
  contains no configuration content, so it does not go stale.

Both publish under the `@vibator` scope and release in lockstep with one
version.

## Development

```sh
npm run verify    # the whole gate: lint, arch, knip, build, test, dogfood
npm run build     # tsc per workspace (only create-gate emits)
npm test          # vitest, from the root
npx vibator       # the repo checks itself; vibator.json extends the preset
npm run lint      # Biome: strict format + lint (complexity <= 8, fn <= 25 lines)
npm run arch      # dependency-cruiser: the two packages stay independent
npm run knip      # dead code and unused dependencies
```

Releases are semantic-release over Conventional Commits (`.releaserc.json`),
cut manually via the Release workflow. Both package.json versions bump
together; `fix:` and `feat:` release, and CI lints the messages.

## Design invariants

Do not undo these without a deliberate decision.

- **The wizard contains no configuration content.** Standards live in
  `@vibator/gate` and reach projects through `extends`; the wizard only
  detects, asks, installs and writes thin pointers. Anything else forces a
  wizard release for every standards change.
- **Never overwrite, never delete.** An existing config gets an `extends`
  entry offered; an existing hook gets a line appended; an existing tool
  choice (lefthook, eslint) is respected or left alone. Re-running the
  wizard is safe: every action skips what is already in place.
- **No orchestration is imposed.** The gate suggests a plain `verify` npm
  script and leaves chaining to the project. No runner, no wrapper, no
  command rule. Integrators may use concurrently or anything else; pieces
  must stay easy to add or remove one by one.
- **Every prompt has a flag equivalent.** `--defaults` accepts every
  recommendation, `--dry-run` prints the plan as JSON and changes nothing,
  and a run without a TTY never hangs: it exits 2 printing the flag-based
  command to use instead.
- **Tools are installed as direct devDependencies** of the target repo, not
  hidden behind this package: pnpm only links direct dependencies' bins, and
  dependabot can only bump what it sees.
- **`create-gate` never imports `@vibator/gate`.** It references the package
  by name in what it writes. dependency-cruiser enforces this; coupling them
  would chain the release cycles.
- **Nothing here names a downstream project.** Presets stay generic: globs
  like `src/**`, no product names, no assumptions about repo layout beyond
  what the wizard detected.

## Conventions

- TypeScript strict, ESM, Node 22 or later.
- TSDoc on every declaration, with `@param` and `@returns`; enforced via
  `tsdoc-coverage` in the repository's own vibator run.
- Names carry meaning; no `data`, `res`, `tmp`.
- Functions stay short (25 lines), files stay under 400 lines.
- Everything with words is direct and plain: one job per sentence, no
  em-dashes, no marketing. This covers docs, CLI output, findings, and
  commit messages.
- The presets in `packages/gate` are the product. Changing one changes every
  downstream repository on its next dependabot bump; treat preset edits like
  API changes and explain them in the commit body.
