# The `codegen-drift` rule

This document is the reference of the `codegen-drift` rule: its options, how
a check runs, and the diagnostics it produces.

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [Detection](#detection): Regenerate, compare, revert.
- [Diagnostics](#diagnostics): Drift, refusals, and generator failures.
- [Fix](#fix): Why there is none.

---

## Configuration

The rule id is `codegen-drift`. It is `off` until a project configures its
generators:

```json
{
  "plugins": [
    "@vibator/recommended"
  ],
  "rules": {
    "codegen-drift": {
      "severity": "error",
      "options": {
        "generators": [
          {
            "name": "api client",
            "command": "npm run generate:client",
            "paths": ["src/api/generated"]
          }
        ]
      }
    }
  }
}
```

| Generator field | Description                                                             |
|-----------------|-------------------------------------------------------------------------|
| name            | Human-readable name, used in messages.                                  |
| command         | Shell command that regenerates the output, run through `vibator.shell`. |
| cwd             | Working directory, relative to the project root. Defaults to `.`.       |
| paths           | Paths the generator writes, relative to the project root.               |
| timeoutMs       | How long to allow before treating the run as stuck. Defaults to 180000. |

The rule takes no `include`/`exclude` globs: the generator's `paths` are the
scope.

## Detection

Per generator: verify the generator's paths are clean through
`vibator.git.status`, run the command, take the status again, and revert
whatever the run wrote (tracked paths through `vibator.git.restore`,
untracked ones deleted). Every path changed by the run is drift. Paths that
are dirty before the run produce a refusal instead: the rule reverts what it
generates and cannot tell in-progress work from its own output. A drifted
file silenced by a `vibator-ignore-file codegen-drift` marker is skipped.

## Diagnostics

One diagnostic per drifted path. A generator whose paths were dirty produces
one refusal diagnostic, and a command that exits non-zero produces one
failure diagnostic carrying the first line of its output; both are
project-level.

## Fix

The fix is the generator itself: run the command from the finding and commit
the result. Doing that from inside a check would commit-by-side-effect, so
the rule implements no `fix` hook.
