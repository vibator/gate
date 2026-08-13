# The `banned-patterns` rule

This document is the reference of the `banned-patterns` rule: its options,
the way patterns match, and the diagnostics it produces.

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [Detection](#detection): How patterns match lines.
- [Diagnostics](#diagnostics): The pattern's own three fields.
- [Errors](#errors): What happens when a pattern does not compile.
- [Fix](#fix): Why there is none.

---

## Configuration

The rule id is `banned-patterns`. It is `off` until a project configures
patterns and turns it on:

```json
{
  "plugins": [
    "@vibator/recommended"
  ],
  "rules": {
    "banned-patterns": {
      "severity": "error",
      "options": {
        "patterns": [
          {
            "pattern": "from \"axios\"",
            "message": "Imports axios directly",
            "expected": "HTTP goes through the shared client",
            "fix": "Import the client from the api module instead"
          }
        ]
      }
    }
  }
}
```

| Option            | Description                                                                              |
|-------------------|------------------------------------------------------------------------------------------|
| include / exclude | The shared vibator scope globs selecting the files the rule judges.                      |
| patterns          | The patterns to ban. Each entry carries `pattern`, `flags`, and its own diagnostic text. |

| Pattern field | Description                                                      |
|---------------|------------------------------------------------------------------|
| pattern       | JavaScript regular expression source, matched against each line. |
| flags         | Regular expression flags, such as `i`. Defaults to none.         |
| message       | What is wrong when the pattern matches.                          |
| expected      | The standard, positively stated.                                 |
| fix           | The concrete next action.                                        |

## Detection

Each pattern is compiled once per run and tested against every line of every
file in scope, comments included. Binary files are skipped, and
`vibator-ignore banned-patterns` markers are honored at file and line level.

## Diagnostics

One diagnostic per matching line. The `message`, `expected`, and `fix`
fields come verbatim from the matching pattern, so the finding reads like
any other rule's.

## Errors

A pattern that is not a valid regular expression produces one project-level
diagnostic instead of a crash.

## Fix

Each pattern's `fix` field already states the concrete action, and applying
it means editing code the way the project prescribes. The rule implements no
`fix` hook.
