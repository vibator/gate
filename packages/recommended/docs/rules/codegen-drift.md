# Generated files match the source they derive from

A finding means regenerating changed a committed file: the committed
artifact no longer matches the source it derives from. The rule reverts what
it generated, so the working tree is left as it found it.

## Resolving a finding

Run the command named in the finding's fix and commit its output together
with the source change, in the same commit.

## Why it is a rule

Database migrations against a schema, API clients against a spec, types
against a query: the failure mode is the same in each case. The code type
checks, the tests pass against freshly generated output, and the bug appears
only where the committed artifact runs.

## If the rule refuses to run

The rule declines to check paths that already have uncommitted changes. It
reverts whatever it generates, and it cannot tell your work in progress from
its own output. Commit or discard those paths first.

## Silencing

- File marker inside a generated file that must diverge:
  `vibator-ignore-file codegen-drift: <reason>` (in whatever comment syntax
  the format allows).
- A generator that should not be checked belongs out of the `generators`
  option, not silenced file by file.
