# @vibator/recommended

A [vibator](https://github.com/vibator/vibator) plugin carrying the
recommended general-purpose rules: checks that apply to almost any
repository.

Loading the plugin registers every rule in the table below. Each rule has
its own id, so each is enabled, configured, and silenced independently.

## Setup

```json
// .vibator.json
{
  "plugins": [
    "@vibator/recommended"
  ],
  "rules": {
    "no-conflict-markers": {}
  }
}
```

Every rule accepts the shared vibator `include` / `exclude` globs, and
`vibator-ignore <rule-id>` / `vibator-ignore-file <rule-id>` markers are
honored at line and file level.

## Rules

Each rule links to its guideline, the document shown with every finding.

| Rule                                                            | What it enforces                                                          |
|-----------------------------------------------------------------|---------------------------------------------------------------------------|
| [`banned-patterns`](./docs/rules/banned-patterns.md)            | Configured patterns stay out of the source, each with its own diagnostic. |
| [`codegen-drift`](./docs/rules/codegen-drift.md)                | Generated files match the source they derive from.                        |
| [`env-example-sync`](./docs/rules/env-example-sync.md)          | The example env file matches the variables the code reads.                |
| [`locale-parity`](./docs/rules/locale-parity.md)                | Every locale carries the same keys as the source locale.                  |
| [`meaningful-names`](./docs/rules/meaningful-names.md)          | Identifiers the project declares carry meaning.                           |
| [`no-conflict-markers`](./docs/rules/no-conflict-markers.md)    | No unresolved merge conflict markers in any file.                         |
| [`no-dead-doc-links`](./docs/rules/no-dead-doc-links.md)        | Relative links in Markdown point at files that exist.                     |
| [`no-deprecated-apis`](./docs/rules/no-deprecated-apis.md)      | No use of APIs marked `@deprecated`.                                      |
| [`prefer-array-methods`](./docs/rules/prefer-array-methods.md)  | Array methods over single-statement loops.                                |
| [`tsdoc-coverage`](./docs/rules/tsdoc-coverage.md)              | Every declaration carries a complete TSDoc contract.                      |

## Design

The design docs under [docs/design/](./docs/design/) are the reference and
the contract: one per rule, covering its configuration, detection, and
diagnostics, plus one for the `vibator.recommended` namespace the AST rules
are written against.

## License

[MIT](../../LICENSE)
