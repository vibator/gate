# Knip finds no unused code or dependencies

A finding means [Knip](https://knip.dev) reports a project hygiene issue:
unused files, unused dependencies or devDependencies, dependencies that are
used but not listed, imports that do not resolve, unused exports and exported
types, unused enum or class members, or duplicate exports. Reference:
<https://knip.dev/overview/getting-started>.

## Resolving a finding

The message names the issue and its bucket, such as `(knip/exports)`, and the
finding's `fix` text states the resolution.

- Run `vibator --write` to let Knip fix what it can: unused exports and types
  are stripped, unused dependencies removed from `package.json`.
- Delete unused files, or add them to Knip's entry points when they are real
  entry points.
- Add unlisted dependencies to `package.json`; fix or install unresolved
  imports.
- For findings that look wrong, see Knip's guide:
  <https://knip.dev/guides/handling-issues>.
- "Knip configuration could not be loaded" means the `configPath` option
  names no file. Fix the path.

Knip analyzes the whole workspace. A scoped run (`--staged`, `--changed`,
`--since`) narrows the report, not the analysis, so a change in one file can
make code in an untouched file unused. Run an unscoped `vibator` (for example
in CI) to catch those.

## Configuration

Knip reads the rule's `configPath` option or discovers its own configuration
(`knip.json`, `knip.ts`, the `knip` field in `package.json`). Reference:
<https://knip.dev/reference/configuration>.

## Silencing

- vibator marker on the line above the finding:
  `// vibator-ignore knip: <reason>`, or for the whole file
  `// vibator-ignore-file knip: <reason>`.
- Knip's own mechanisms in its configuration: `ignore`,
  `ignoreDependencies`, `ignoreBinaries`, entry patterns. Reference:
  <https://knip.dev/reference/configuration>.
- Mark an export as intentionally public with a `@public` JSDoc tag.
  Reference: <https://knip.dev/reference/jsdoc-tsdoc-tags>.
