/**
 * This repository's boundaries, on top of the universal rules it ships.
 * The packages are the layers:
 *   packages/gate         - pure configuration data; no source, no imports
 *   packages/create-gate  - the wizard; references @vibator/gate by name in
 *                           what it writes, never by importing it, so the
 *                           two stay independently releasable
 * Run with `npm run arch`.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  extends: "./packages/gate/depcruise.cjs",
  forbidden: [
    {
      name: "packages-stay-separate",
      severity: "error",
      comment:
        "The wizard writes configs that point at @vibator/gate; importing " +
        "it would couple the two packages' release cycles.",
      from: { path: "^packages/create-gate/" },
      to: { path: "^packages/gate/" },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
  },
};
