/**
 * The wizard's help text. Kept out of the entry point so tests can call
 * it directly.
 *
 * @packageDocumentation
 */

/** The flag reference, one line per flag. */
const FLAG_LINES = [
  "Every prompt has a flag, so the wizard runs without a terminal:",
  "  --defaults           accept every recommendation (alias: --yes)",
  "  --dry-run            print the plan as JSON, change nothing",
  "  --skip-install       write files but run no package installs",
  "  --dir <path>         target directory (default: current)",
  "  --lint=create|extend|skip       Biome",
  "  --vibator=create|extend|skip    vibator",
  "  --knip=yes|skip                 knip",
  "  --depcruise=yes|skip            dependency-cruiser",
  "  --tsconfig=yes|skip             extend the strict tsconfig base",
  "  --hooks=yes|skip                git hooks (husky, or your manager)",
  "  --commitlint=yes|skip           Conventional Commit linting",
  "  --ci=yes|skip                   GitHub Actions quality workflow",
  "  --agents=yes|skip               gate section and skills catalog in AGENTS.md",
  "  --migrations=yes|skip           run offered migration commands after apply",
];

/**
 * Renders the command line usage.
 *
 * @param version - The package version to display.
 * @returns The full help text.
 */
export function usage(version: string): string {
  return [
    `create-gate ${version}`,
    "",
    "Bootstraps the vibator gate in a JavaScript or TypeScript repository:",
    "Biome, knip, dependency-cruiser and vibator, wired as thin configs",
    "that extend @vibator/gate.",
    "",
    "Usage:",
    "  npm create @vibator/gate [-- flags]",
    "",
    ...FLAG_LINES,
    "",
    "The wizard never overwrites an existing configuration: it adds an",
    "extends entry, appends to hooks, and leaves the rest alone. Re-running",
    "is safe: every action skips what is already in place.",
  ].join("\n");
}
