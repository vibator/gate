/**
 * Universal dependency rules every project benefits from. Layer boundaries
 * are project-specific: state them in your own config, which extends this
 * one with `extends: "@vibator/gate/depcruise"`. Rules merge by name, so a
 * project can restate one of these to change its severity.
 *
 * In a TypeScript project, also set `options.tsConfig` locally so aliased
 * imports resolve.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular dependencies make the graph hard to reason about and test.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-test-deps-in-src",
      severity: "error",
      comment: "Production code must not import test files.",
      from: { pathNot: "\\.(test|spec)\\.[cm]?[tj]sx?$" },
      to: { path: "\\.(test|spec)\\.[cm]?[tj]sx?$" },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment:
        "An import that resolves to nothing fails at runtime, not at review.",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-non-package-json",
      severity: "error",
      comment:
        "Depending on a package that is not in package.json works only " +
        "until the next clean install.",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "not-to-dev-dep",
      severity: "error",
      comment:
        "Production code relying on a devDependency breaks in a production " +
        "install. Type-only imports are allowed.",
      from: { path: "(^|/)src/", pathNot: "\\.(test|spec)\\.[cm]?[tj]sx?$" },
      to: {
        dependencyTypes: ["npm-dev"],
        dependencyTypesNot: ["type-only"],
        pathNot: ["node_modules/@types/"],
      },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment: "A module nothing imports is either dead or missing its wiring.",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(cjs|mjs|js|json)$",
          "\\.d\\.ts$",
          "(^|/)(babel|jest|vite|vitest|webpack)\\.config\\.",
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: {
      path: "node_modules|/dist/|/build/|/coverage/",
    },
  },
};
