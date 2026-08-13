# Project-banned patterns stay out of the source

A finding means a line matches a pattern the project has banned. The
message, expectation, and fix are the project's own, written in the rule's
configuration.

## Resolving a finding

Follow the finding's `fix` text: it is the action the project prescribes for
this pattern. Patterns match line by line against the file's text, comments
included. If a pattern matches prose or an example it should not, make the
pattern in the configuration more precise; the rule does not guess which
lines are code.

## Why it is a rule

Most standards that keep coming up in code review are pattern-shaped: a
client that must not be imported directly, a legacy module new code must not
reach into, a `TODO` without a ticket, a hard-coded hostname. Each one is
too project-specific to ship as a built-in check, so it gets repeated in
review instead of enforced. This rule turns those review comments into
configuration.

## Configuration

The rule is `off` until the project sets patterns and a severity. Each
pattern carries its own `message`, `expected`, and `fix`, written with the
same care as a built-in rule's. A pattern that needs context a regular
expression cannot see (types, scopes, import graphs) has outgrown this rule
and deserves a rule of its own.

## Silencing

- vibator marker on the line above the match:
  `vibator-ignore banned-patterns: <reason>`, or for the whole file
  `vibator-ignore-file banned-patterns: <reason>`.
- Removing or narrowing a pattern belongs in the rule's configuration, not
  in a comment.
