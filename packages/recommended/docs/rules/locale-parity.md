# Every locale carries the same keys as the source

A finding means a locale catalog and the source locale disagree: keys are
missing, keys exist that the source does not have, or a catalog is missing
or unparsable.

## Resolving a finding

- Missing keys: add them to the locale's catalog, seeded with the source
  text until translated. A fallback text in the right structure beats a
  missing key at runtime.
- Extra keys: remove them, or add them to the source locale. Extra keys are
  usually a half-applied rename.
- A missing or unparsable catalog: copy the source catalog named in the fix
  text and translate it.

## Why it is a rule

Typed translation keys prove a key exists in the source locale; nothing
proves it was seeded to the others. A key added to one locale alone silently
falls back at runtime for every other language, and the first person to see
the wrong language is a user.

## Configuration

The rule is `off` until the project sets `root`. The `source`, `layout`, and
`locales` options describe the catalog tree; see the rule's design doc for
the two supported layouts.

## Silencing

- File marker inside a catalog that must diverge, as a JSON value:
  `"comment": "vibator-ignore-file locale-parity: <reason>"`.
- A locale that is intentionally partial is better listed out of the
  `locales` option than silenced.
