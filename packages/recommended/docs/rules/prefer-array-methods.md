# Array methods over single-statement loops

A finding means a loop's body is one statement with no `break`, `continue`,
`return` or `await`, so an array method can usually express it.

## Resolving a finding

Use `forEach`, `map`, `filter`, `flatMap` or `reduce`, whichever names what
the loop does.

## Why it is a rule

The array method names the operation. `map` says a value comes back per
element, `filter` says some are dropped, `forEach` says nothing is returned.
A bare `for` says only that something repeats, and leaves the reader to work
out which case applies.

## Why it ships as a warning

The check is syntactic and cannot know what the loop iterates. A `Set`, a
`Map` or a generator has no `map` or `filter`, so a single-statement loop
over one can be flagged even though a direct rewrite is not possible.
Convert with `[...iterable]` where that reads well, use the ignore marker
where it does not, and raise the rule to `error` in config once the
codebase's loops are mostly over arrays. If Biome's `noForEach` or a similar
rule points the opposite way, keep only one of the two.

## Silencing

- vibator marker on the line above the loop, with a required reason:

  ```ts
  // vibator-ignore prefer-array-methods: hot path, runs per audio frame
  for (let index = 0; index < input.length; index++) {
  ```

  For a whole file use `vibator-ignore-file prefer-array-methods: <reason>`.
- This is not a ban on loops: bodies with escaping control flow are never
  reported.
