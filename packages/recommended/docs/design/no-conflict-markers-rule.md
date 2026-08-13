# The `no-conflict-markers` rule

This document is the reference of the `no-conflict-markers` rule: its
options, the markers it matches, and the diagnostics it produces.

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [Detection](#detection): The marker lines the rule matches.
- [Diagnostics](#diagnostics): One finding per file.
- [Fix](#fix): Why there is none.

---

## Configuration

The rule id is `no-conflict-markers`. Configure it in `.vibator.json`:

```json
{
  "plugins": [
    "@vibator/recommended"
  ],
  "rules": {
    "no-conflict-markers": {}
  }
}
```

| Option            | Description                                                                                            |
|-------------------|--------------------------------------------------------------------------------------------------------|
| include / exclude | The shared vibator scope globs. The defaults are `["**/*"]` and `[]`: every file, test files included. |

## Detection

A line matches when it starts with one of the four markers git writes:
`<<<<<<< `, `||||||| `, `>>>>>>> `, or a line of exactly seven `=`. The
first three keep their trailing space so a row of angle brackets in prose
does not match. `|||||||` only appears when `merge.conflictStyle` is
`diff3`. Binary files are skipped, and `vibator-ignore no-conflict-markers`
markers are honored at file and line level.

## Diagnostics

One diagnostic per file, not one per marker line: it points at the first
marker line no ignore marker silences. A single merge leaves several marker
lines, and finishing the merge resolves them all.

## Fix

Finishing a merge means choosing a side, which is not a safe mechanical
edit. The rule implements no `fix` hook, so `vibator --write` leaves its
findings for a human.
