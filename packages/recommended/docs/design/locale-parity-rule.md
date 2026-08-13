# The `locale-parity` rule

This document is the reference of the `locale-parity` rule: its options, the
layouts it understands, and the diagnostics it produces.

## Reference

- [Configuration](#configuration): The options the rule accepts.
- [Detection](#detection): Layouts, locale discovery, and key comparison.
- [Diagnostics](#diagnostics): Missing keys, extra keys, broken catalogs.
- [Fix](#fix): Why there is none.

---

## Configuration

The rule id is `locale-parity`. It is `off` until a project points it at its
locale catalogs:

```json
{
  "plugins": [
    "@vibator/recommended"
  ],
  "rules": {
    "locale-parity": {
      "severity": "error",
      "options": {
        "root": "src/locales"
      }
    }
  }
}
```

| Option  | Description                                                                                                      |
|---------|------------------------------------------------------------------------------------------------------------------|
| root    | Directory holding the locale catalogs. Required.                                                                 |
| source  | The locale every other is seeded from. Defaults to `en`.                                                         |
| layout  | `directory-per-locale` expects `root/<locale>/<namespace>.json`; `file-per-locale` expects `root/<locale>.json`. |
| locales | The locales to check. Discovered from the layout when omitted, ignoring loose files such as a README.            |

The rule takes no `include`/`exclude` globs: the catalogs come from `root`
and the layout.

## Detection

Catalogs parse through `vibator.json.parse`, and nested namespaces flatten
into dotted key paths (`actions.save`). Each locale's key set is compared
against the source locale's; the source itself is never reported. A catalog
silenced by a `vibator-ignore-file locale-parity` marker is skipped.

## Diagnostics

Per catalog, one diagnostic for missing keys and one for extra keys, each
listing up to eight key paths with a count of the rest. A catalog that is
missing or unparsable gets one diagnostic. An unreadable `root` or source
locale produces one project-level diagnostic instead of a crash.

## Fix

Which side of a key difference is right (translate the key or delete it) is
a human call. The rule implements no `fix` hook.
