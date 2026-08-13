# The `no-dead-doc-links` rule

This document is the reference of the `no-dead-doc-links` rule: its options,
the links it judges, and the diagnostics it produces.

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [Detection](#detection): The links the rule judges.
- [Diagnostics](#diagnostics): One finding per dead link.
- [Fix](#fix): Why there is none.

---

## Configuration

The rule id is `no-dead-doc-links`. Configure it in `.vibator.json`:

```json
{
  "plugins": [
    "@vibator/recommended"
  ],
  "rules": {
    "no-dead-doc-links": {}
  }
}
```

| Option            | Description                                                          |
|-------------------|----------------------------------------------------------------------|
| include / exclude | The shared vibator scope globs. `include` defaults to `["**/*.md"]`. |

## Detection

Every Markdown link and image whose target is inside the repository is
judged: relative targets resolve against the file, and a leading `/`
resolves from the project root. Anchors and queries are stripped, so
`guide.md#setup` checks only that `guide.md` exists. A target may name a
file or a folder. External URLs, protocol links, and anchor-only links are
skipped. Link syntax inside fenced code blocks and inline code spans is
example text, blanked through `vibator.text.maskCode` before matching.
`vibator-ignore no-dead-doc-links` markers are honored at file and line
level.

## Diagnostics

One diagnostic per dead link, on the line the link appears on, naming the
target that does not resolve.

## Fix

Whether the path or the link is wrong is the author's call. The rule
implements no `fix` hook.
