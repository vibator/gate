# Relative links in Markdown point at files that exist

A finding means a relative link or image in a Markdown file points at a path
where no file or folder exists.

## Resolving a finding

Fix the path or remove the link. Relative targets (`./docs/guide.md`,
`../README.md`, `images/flow.png`) resolve against the file; a leading `/`
resolves from the repository root. Anchors and queries are ignored:
`guide.md#setup` checks only that `guide.md` exists. External URLs,
`mailto:` links, and pure `#anchor` links are not checked, and link syntax
inside code blocks and code spans is treated as example text.

## Why it is a rule

Documentation is the part of a change nothing type checks. Move or rename a
source file and every import either updates or the build fails; a README
that pointed at the old path keeps pointing at nothing, and the first person
to notice is a reader months later. Automated refactors are especially prone
to this, because they update every reference the compiler checks, and
Markdown is not one of them.

## Silencing

- vibator marker on the line above the link:
  `vibator-ignore no-dead-doc-links: <reason>`, or for the whole file
  `vibator-ignore-file no-dead-doc-links: <reason>`.
- A link that must point at a generated or git-ignored file (one that exists
  after a build but not in a fresh checkout) is better rewritten to point at
  the source that generates it. If that is not possible, exclude the
  document via the rule's `exclude` globs.
