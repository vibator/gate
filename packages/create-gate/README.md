# @vibator/create-gate

The setup wizard for the vibator gate. Run it in a JavaScript or
TypeScript repository:

```sh
npm create @vibator/gate
```

It walks numbered steps, one per tool. Each step shows what the tool is
for, the exact changes as a diff, and the warnings. Say yes and the step
is applied. Follow-ups such as `biome migrate` or replacing a taken npm
script run only if you say yes to them too.

It never overwrites or deletes anything. Existing configs get an
`extends` entry pointing at [`@vibator/gate`](../gate), existing hooks get
the missing lines, other choices stay yours. Re-running is safe: it asks
again and fixes only what is missing.

## Without a terminal

Every prompt has a flag, so scripts can run it end to end:

```sh
npm create @vibator/gate -- --defaults              # accept recommendations
npm create @vibator/gate -- --defaults --dry-run    # JSON plan, no changes
npm create @vibator/gate -- --lint=extend --knip=yes --depcruise=yes \
  --vibator=create --tsconfig=yes --hooks=yes --commitlint=yes \
  --ci=skip --agents=yes --migrations=yes
```

Without a terminal and without enough flags it exits with code 2 and
prints the way out. It never hangs. After an interactive session it
prints the flags-only command that repeats the same choices.

`--help` lists every flag.
