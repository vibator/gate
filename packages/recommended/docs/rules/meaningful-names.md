# Identifiers the project declares carry meaning

A finding means a declared identifier is a filler name (`data`, `tmp`,
`res`) or too short to say what it holds.

## Resolving a finding

Rename the identifier to say what the value is: `parsedQuote`, not `data`;
`response`, not `res`. Names starting with `_` are conventionally unused and
never reported.

## Why it is a rule

`data`, `res`, `tmp`, `item` and `val` are the most common identifiers in
existing code, so autocompletion and code generation reach for them by
default, and no type checker objects. A reader then has to reconstruct from
context what the author already knew.

## Configuration

Short names a library imposes belong in the `allow` option; the `deny` list
and the minimum length are also configurable.

## Silencing

- vibator marker on the line above the declaration, with a required reason:

  ```ts
  // vibator-ignore meaningful-names: published cyrb53 state name
  let h1 = 0xdeadbeef ^ seed;
  ```

  A marker above an enclosing function or class covers everything inside.
  For a whole file use `vibator-ignore-file meaningful-names: <reason>`.
- Recurring legitimate names belong in the `allow` option, not in comments.
