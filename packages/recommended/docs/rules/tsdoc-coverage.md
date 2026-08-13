# Every declaration carries a complete TSDoc contract

A finding means a declaration is missing its TSDoc block, a `@param` or
`@returns` tag is missing, a member is documented with a `//` comment, or a
`//` run outgrew the cap.

## Resolving a finding

- "needs a TSDoc block": write the block stating what the declaration does.
- "missing @param": add one tag per parameter, in order, with a one-line
  description.
- "missing @returns": state what comes back. `void`, `never`,
  `Promise<void>`, assertion signatures and type predicates never need it.
- "replace the `//` comment": the words are probably right; move them into
  a `/** ... */` block so tooling and editors pick them up.
- A long `//` run: move the explanation into the enclosing declaration's
  TSDoc, where the next reader looks first.

## Why it is a rule

A TSDoc block is the one place every editor, reader, and tool looks for a
declaration's contract. A `//` note above the declaration carries the same
words and none of the reach.

## Configuration

`requireOn: "exported"` limits the bar to the surface other files consume,
which is the gentler setting for a codebase adopting the rule late. The
`requireParams`, `requireReturns`, and `maxInlineCommentLines` options
narrow the contract further.

## Silencing

- vibator marker on the line above the declaration:
  `// vibator-ignore tsdoc-coverage: <reason>`, or for the whole file
  `vibator-ignore-file tsdoc-coverage: <reason>`.
- Generated or vendored code belongs in the rule's `exclude` globs, not
  under markers.
