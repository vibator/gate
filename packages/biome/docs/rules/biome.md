# Biome reports no issues

A finding means the [Biome](https://biomejs.dev) linter reports an issue in
the file, or the Biome configuration could not be loaded.

## Resolving a finding

The message ends with the Biome category, such as
`lint/suspicious/noDoubleEquals`.

- Each lint rule has an official page at
  `https://biomejs.dev/linter/rules/<rule-name-in-kebab-case>/`. For
  `lint/suspicious/noDoubleEquals` that is
  <https://biomejs.dev/linter/rules/no-double-equals/>. The page states what
  the rule checks, why, and how to fix it.
- Run `vibator --write` to apply Biome's safe fixes. Findings whose fix Biome
  marks unsafe stay reported; fix those by hand following the rule's page.
- "Biome configuration could not be loaded" means the `configPath` option or
  the root `biome.json`/`biome.jsonc` names no file or fails to parse. Fix
  the path or the file.

## Configuration

The active rules come from the Biome configuration: the rule's inline
`config` option, its `configPath` option, or `biome.json`/`biome.jsonc` at
the project root. Reference:
<https://biomejs.dev/reference/configuration/>.

## Silencing

- vibator marker on the line above the finding:
  `// vibator-ignore biome: <reason>`, or for the whole file
  `// vibator-ignore-file biome: <reason>`.
- Biome's own suppression on the line above:
  `// biome-ignore lint/<group>/<rule>: <reason>`. It also silences the
  finding for other Biome consumers (editors, CI). Reference:
  <https://biomejs.dev/analyzer/suppressions/>.
- Turning the rule off for the project belongs in the Biome configuration,
  not in a comment.
