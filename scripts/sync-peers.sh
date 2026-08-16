#!/bin/sh
# Points the wizard's peer ranges at the versions the workspace ships. Runs from
# the wizard's semantic-release prepare step, after the plugins have released.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

for manifest in packages/*/package.json; do
  name=$(node -p "require('./$manifest').name")
  if [ "$name" != "@vibator/create-gate" ]; then
    version=$(node -p "require('./$manifest').version")
    npm pkg set "peerDependencies.$name=^$version" -w packages/create-gate
  fi
done
