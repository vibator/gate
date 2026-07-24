---
name: using-the-vibator-gate
description: "Work in a repository gated by @vibator/gate: run the quality gate (Biome, knip, dependency-cruiser, vibator), read machine-readable findings, fix them at the source, and adjust standards through the thin local configs instead of weakening the shared preset. Use when a gate check fails, when asked to run or fix quality checks, or when a standard needs tuning for this project."
---

# Use the vibator gate

This repository's quality configs are thin files extending the shared
presets in `@vibator/gate`. The standards live in the installed package;
the local files state only what differs.

## Run the gate

Run the whole gate with the repository's own script, usually:

```sh
npm run verify
```

If there is no such script, run the tools directly; each is independent and
they can run in any order:

```sh
npx biome check          # format + lint
npx knip                 # dead code and unused dependencies
npx depcruise src --config .dependency-cruiser.cjs
npx vibator              # the standards the other tools cannot see
```

For machine-readable vibator output, use `npx vibator --reporter json`:
every finding carries `message` (what is wrong), `expected` (the standard)
and `fix` (the next action) as separate fields, plus `docs[].absolutePath`
pointing at the guideline in force. Act on `fix`; open the guideline when
the reason matters.

Scope a run to your changes with `npx vibator --changed`, or to a branch
with `npx vibator --since origin/main`.

## Ground rules

- **Fix findings at the source.** Never weaken a gate to make it pass: no
  widened budgets, no new excludes, no rules switched off because they
  currently fail. If a fix is out of scope, leave the check failing and say
  so.
- **The presets are not yours to edit.** Never change anything under
  `node_modules/@vibator/gate`; the next install replaces it. A project
  difference belongs in the thin local config; a standards change belongs in
  the preset package and is a human's decision.
- **Per-line escape, with a reason**: `// vibator-ignore: <reason>` on the
  line above a finding. The reason is required. Biome has its own
  suppression comments; use each tool's mechanism, always with a reason.
- **No baselines.** Adopt incrementally with `--changed` or `--since`, never
  by recording current violations as accepted.

## Adjust a standard for this project

State the difference in the thin config that extends the preset:

```json
{
  "extends": ["@vibator/gate/vibator"],
  "rules": {
    "max-file-size": { "options": { "maxKb": 1024 } }
  }
}
```

The file line budget is Biome's (`style/noExcessiveLinesPerFile`); adjust
it under `linter.rules.style` in `biome.json`.

The same pattern applies to the other tools: `biome.json` extends
`@vibator/gate/biome`, `.dependency-cruiser.cjs` extends
`@vibator/gate/depcruise` (rules merge by name, so restating a rule locally
overrides it), `tsconfig.json` extends `@vibator/gate/tsconfig`.

In vibator configs, `include`/`exclude` arrays replace the preset's; copy
the globs you want to keep before narrowing.

## Where to read more

- `npx vibator explain <rule>` prints the guideline behind a rule.
- `npx vibator docs configuration` prints the config format, including how
  `extends` merges.
- The gate's own standards document ships with the preset:
  `node_modules/@vibator/gate/docs/standards.md`.
