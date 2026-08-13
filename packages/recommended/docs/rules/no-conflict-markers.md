# No unresolved merge conflict markers

A finding means the file carries a `<<<<<<< `, `||||||| `, `=======` or
`>>>>>>> ` line: a merge was left half-done.

## Resolving a finding

Finish the merge. Delete every marker line and keep the intended side. The
rule reports one finding per file, on the first marker line; check the rest
of the file for more. `|||||||` only appears when `merge.conflictStyle` is
`diff3`, which is why it is the marker most often left behind.

## Why it is a rule

A marker in source code fails the build: the file is compiled, minified, or
bundled, and the broken syntax stops it. Configuration files, documentation,
and data files pass through no such step, and only a linter for that format
would catch the marker. Those are the files where a half-finished merge, by
a person or a coding agent, ships silently.

## Silencing

- vibator marker on the line above the marker:
  `vibator-ignore no-conflict-markers: <reason>`, or for the whole file
  `vibator-ignore-file no-conflict-markers: <reason>`.
- A silenced marker is still a marker. The only good reason to silence this
  rule is a file that documents or demonstrates conflict markers.
