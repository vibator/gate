# The example env file matches what the code reads

A finding means the example env file and the code disagree: a variable the
code reads is not documented, a documented variable is read by nothing, or
the example file does not exist at all.

## Resolving a finding

- A variable read but not documented: add it to the example file with a
  comment describing what it does and its default. A live `NAME=value`, a
  commented `# NAME=value`, or a name leading an aligned comment table all
  count as documented.
- A variable documented but read by nothing: remove it, or list it under
  the rule's `externallyConsumed` option when a compose file or container
  entrypoint consumes it.
- A variable the runtime or CI supplies (never set by an operator): list it
  under the rule's `ambient` option.

## Why it is a rule

The example file is the only description of what a deployment must supply,
and nothing links it to the code, so it drifts in both directions. An
undocumented variable is one a production deployment silently runs without.
A documented variable nothing reads is one operators keep setting for no
reason.

## Limits

Matching is textual, so a name assembled at runtime from a prefix is
missed. Writing variable names out in full keeps this rule working.

## Silencing

- vibator marker on the line above an entry in the example file:
  `# vibator-ignore env-example-sync: <reason>`, or for a whole file
  `vibator-ignore-file env-example-sync: <reason>` (on a source file it
  excludes its reads from the scan).
- Recurring exceptions belong in the `ambient` or `externallyConsumed`
  options, not in comments.
