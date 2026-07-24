# The gate's standards

This document explains the standards the `@vibator/gate` presets enforce and
how to adjust them for one project without weakening them for all. Findings
in a gated repository link here.

The gate exists for code written with agents. An agent applies the standards
it is told about while its context is fresh and drifts as the context grows.
These checks restate the standards on every run, with a message, the
expectation and the concrete fix, so the drift is caught at the gate instead
of in review.

## What is enforced, and the failure each check prevents

- **Files stay under 400 lines** (Biome: `noExcessiveLinesPerFile`).
  Agents append to existing files far more readily than they split them. A
  file that keeps growing becomes a file nothing can safely edit.
- **Every declaration carries documentation** (`tsdoc-coverage`).
  Undocumented code written by an agent has no second source of intent:
  nobody can later tell what it was supposed to do, only what it does.
- **Names carry meaning** (`meaningful-names`). `data`, `res` and `tmp` are
  how generated code reads when nobody pushed back. The next reader, human
  or agent, starts from zero.
- **Loops that are transformations use array methods**
  (`prefer-array-methods`). A single-statement `for` hides a `map` or
  `filter`; naming the operation states the intent.
- **No calls into deprecated APIs** (`no-deprecated-apis`). Deprecated calls
  compile, pass review and break on the next major. Agents reproduce them
  from training data long after the ecosystem moved on.
- **Complexity stays low, functions stay short** (Biome: cognitive
  complexity at most 8, 25 lines per function). Small units are the ones an
  agent can modify without collateral damage.
- **Dependencies stay sound** (dependency-cruiser: no cycles, no imports of
  test files from production code, no unresolvable imports, no dependencies
  missing from package.json, no devDependencies in production code).
- **Nothing is dead** (knip). Unused exports, files and dependencies are
  where generated code quietly accumulates.

## Adjust a standard

Your project's configs are thin files that extend the presets. State the
difference locally; never edit anything under `node_modules`, the next
install replaces it.

Change a budget or severity for this project only:

```json
{
  "extends": ["@vibator/gate/vibator"],
  "rules": {
    "max-file-size": { "options": { "maxKb": 1024 } }
  }
}
```

The line budget lives in the Biome preset; raise it in your `biome.json`:

```json
{
  "extends": ["@vibator/gate/biome"],
  "linter": {
    "rules": {
      "style": {
        "noExcessiveLinesPerFile": {
          "level": "error",
          "options": { "maxLines": 600 }
        }
      }
    }
  }
}
```

A bare severity keeps the preset's globs and options:

```json
"prefer-array-methods": "error"
```

Exempt a single line with a reason (the reason is required):

```ts
// vibator-ignore: hot path, runs per audio frame
```

Adopt incrementally with `npx vibator --since origin/main`: new work is
checked now, old files when they are next touched. Do not build a baseline;
recorded violations stop being violations.

## When a check fails

Fix the finding, not the check. Each finding states what is wrong, what was
expected and the next action; `npx vibator explain <rule>` prints the full
guideline. If a standard is genuinely wrong for your project, change it in
your thin config with the reason in the commit message. That decision is a
human's call, not something to do quietly to make a run pass.
