# No use of APIs marked @deprecated

A finding means an import, reference, or call reaches a declaration whose
documentation carries a `@deprecated` tag.

## Resolving a finding

Follow the finding's `expected` text: it is the replacement advice the
deprecated declaration's own author wrote. "no replacement given" means the
tag is bare; check the declaration's documentation or the library's
changelog for the successor.

## Why it is a rule

Deprecation is the one compiler signal deliberately not an error: the code
keeps building and keeps working right up to the major release that deletes
it. Editors strike it through and nothing else notices, least of all a
generated patch, which reproduces whatever pattern was most common in its
training data and so reaches for the older API more often than the newer
one.

## Configuration

The `projects` option names the tsconfig files whose programs resolve the
symbols; the rule needs a type checker, so a file outside every project is
not judged.

## Silencing

- vibator marker on the line above the usage:
  `// vibator-ignore no-deprecated-apis: <reason>`, or for the whole file
  `vibator-ignore-file no-deprecated-apis: <reason>`. A marker above an
  enclosing function or class covers everything inside.
- A migration that must land in stages earns a marker with the tracking
  ticket as the reason.
