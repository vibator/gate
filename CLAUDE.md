# vibator-plugins

An npm workspace of [vibator](https://github.com/vibator/vibator) plugins.
Each plugin drives another linter through its JavaScript API and maps its
findings to vibator diagnostics.

Read each package's `docs/design/` before changing behavior. Those files are
the contract: the subnamespace a package registers and the rule it defines.
Update the design doc in the same change as the code.

## Layout

```
packages/
  biome/            the `biome` rule and the `vibator.biome` subnamespace,
                    driving Biome through `@biomejs/js-api`.
  knip/             the `knip` rule and the `vibator.knip` subnamespace,
                    driving Knip through its programmatic API.
  depcruise/        the `depcruise` rule and the `vibator.depcruise`
                    subnamespace, driving dependency-cruiser through `cruise()`.
  recommended/      the recommended general-purpose rules and the
                    `vibator.recommended` subnamespace of TypeScript syntax
                    analyses, driving the `typescript` module directly.
```

Each package follows the same two layers:

```
src/
  namespace/        the subnamespace registered onto the shared `vibator`
                    object. The only module that touches the tool's API.
  rules/            the rule, written against `vibator` plus the subnamespace.
  index.ts          imports both for their registration side effects and
                    re-exports the namespace types.
```

## Working on it

```sh
npx vitest run                        # the tests
npx tsc --noEmit                      # the types
npm run build                         # the published output of every package
npm run verify                        # the whole gate
```

Work test-first, one module at a time: write the test, run it red, write the
code, run it green. Every function gets a test unless it is a trivial
re-export.

## Invariants

Do not undo these.

- A tool is driven through its JavaScript API, never through a shell command.
- The subnamespace is the only module that imports the tool. A rule reads
  `vibator` and the subnamespace, nothing else.
- Importing a module registers it: the namespace assigns itself onto
  `vibator`, the rule registers through `defineRule`.
- A broken tool configuration becomes a project-level diagnostic, not a crash.
- The three diagnostic fields stay separate: `message`, `expected`, `fix`.
- Every diagnostic honors `vibator.ignore` markers at file and line level.
- The source stays erasable TypeScript, but the packages publish compiled
  JavaScript from `dist/`. Node refuses to strip types under `node_modules`,
  so a package that ships `.ts` entry points cannot be installed.
- Every package builds with `tsc -p tsconfig.build.json`. The per-package
  file sets only `outDir`, `rootDir`, `include`, and `exclude`; every other
  setting lives in the root `tsconfig.build.json`. TypeScript resolves
  relative paths against the config that declares them, so those four cannot
  move to the root.
- Tests build throwaway projects under `os.tmpdir()` with the workspace
  `node_modules` linked. No test depends on files at the repository root.
  Linked packages resolve to their realpath outside `node_modules`, so tests
  do not exercise the published layout. Verify packaging with `npm pack` and
  a real install.

## Writing

Documentation, comments, commit messages, and user-facing strings use direct
language.

- Write plain declarative sentences. State the fact, then at most one sentence of
  why.
- No em-dashes. Use commas, colons, parentheses, periods.
- No rambling, aphorisms, or clever turns. No "X is what makes Y"; write the fact
  or "Y because X".
- No idioms or unusual verbs. Name things for what they are. No cute jargon.
- One fact per bullet. Paragraphs of one to three short sentences.
- Reference docs carry no essays. A one-line table entry is the documentation;
  add a section only when asked.
- TSDoc every function, private ones included, with complete `@param` and
  `@returns`. Module headers are one line; no explanatory paragraphs.
