/**
 * Builders for the thin files the wizard writes. Every file is a pointer at
 * `@vibator/gate`; no standard is stated here, so the wizard never goes
 * stale when the standards change.
 *
 * @packageDocumentation
 */
import type { PackageManager } from "./plan.ts";
import { GATE_PACKAGE } from "./plan.ts";

/**
 * The thin Biome configuration, in Biome's own formatting.
 *
 * @returns File contents for `biome.json`.
 */
export function biomeConfig(): string {
  return `{\n  "extends": ["${GATE_PACKAGE}/biome"]\n}\n`;
}

/**
 * The thin vibator configuration, in Biome's own formatting.
 *
 * @param usesTypeScript - Whether the project uses TypeScript. Without it,
 * the type-aware rule is disabled locally so the gate runs without the
 * optional `typescript` peer.
 * @returns File contents for `vibator.json`.
 */
export function vibatorConfig(usesTypeScript: boolean): string {
  const rules = usesTypeScript
    ? ""
    : `,\n  "rules": {\n    "no-deprecated-apis": "off"\n  }`;
  return (
    `{\n  "$schema": "./node_modules/vibator/schema.json",\n` +
    `  "extends": ["${GATE_PACKAGE}/vibator"]${rules}\n}\n`
  );
}

/**
 * The thin dependency-cruiser configuration.
 *
 * @param usesTypeScript - Whether to resolve through tsconfig.json.
 * @returns File contents for `.dependency-cruiser.cjs`.
 */
export function depcruiseConfig(usesTypeScript: boolean): string {
  const options = usesTypeScript
    ? `  options: {\n    tsConfig: { fileName: "tsconfig.json" },\n    tsPreCompilationDeps: true,\n  },\n`
    : "";
  return (
    `/** @type {import('dependency-cruiser').IConfiguration} */\n` +
    `module.exports = {\n` +
    `  extends: "${GATE_PACKAGE}/depcruise",\n` +
    `  // Your layer boundaries go here; rules merge by name.\n` +
    `  forbidden: [],\n${options}};\n`
  );
}

/**
 * The commitlint configuration. Plain conventional-commits; there is
 * nothing gate-specific to share, so no indirection through the gate.
 *
 * @returns File contents for `.commitlintrc.json`.
 */
export function commitlintConfig(): string {
  return `{ "extends": ["@commitlint/config-conventional"] }\n`;
}

/** How each package manager installs from a lockfile in CI. */
const CI_INSTALL: Record<PackageManager, string> = {
  npm: "npm ci",
  pnpm: "corepack enable && pnpm install --frozen-lockfile",
  yarn: "corepack enable && yarn install --immutable",
  bun: "bun install",
};

/**
 * The quality workflow for GitHub Actions.
 *
 * @param packageManager - The manager that installs and runs `verify`.
 * @returns File contents for `.github/workflows/quality.yml`.
 */
export function qualityWorkflow(packageManager: PackageManager): string {
  const setupBun =
    packageManager === "bun" ? "      - uses: oven-sh/setup-bun@v2\n" : "";
  return (
    `name: Quality\n\non:\n  pull_request:\n  push:\n    branches: [main]\n\n` +
    `jobs:\n  quality:\n    runs-on: ubuntu-latest\n    steps:\n` +
    `      - uses: actions/checkout@v4\n        with:\n          fetch-depth: 0\n` +
    `      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n` +
    `${setupBun}      - run: ${CI_INSTALL[packageManager]}\n` +
    `      - run: ${packageManager} run verify\n`
  );
}

/** The skills catalog for the gate's own bundled skill. */
const GATE_SKILLS_CATALOG = [
  "",
  "### Agent skills",
  "",
  "These packages bundle agent skills (a folder with a SKILL.md, following",
  "the Agent Skills format). They are not installed automatically; install",
  "the ones your agent should use.",
  "",
  `- \`using-the-vibator-gate\` (ships in \`node_modules/${GATE_PACKAGE}/skills/\`):`,
  "  how to run the gate, act on findings, and adjust standards through the",
  "  thin local configs. Install it by copying the folder into your agent's",
  "  skills directory.",
];

/** The skills catalog for vibator's bundled skills. */
const VIBATOR_SKILLS_CATALOG = [
  "- `configuring-vibator`: set up or tune vibator.json from what the",
  "  project contains.",
  "- `fixing-vibator-findings`: fix findings at the source instead of",
  "  weakening the gate.",
  "- `writing-vibator-rules`: write custom rules for standards the built-in",
  "  ones do not cover.",
  "  These three ship with vibator: list them with `npx vibator skills` and",
  "  install them with `npx vibator skills --install`.",
];

/**
 * The section describing the gate to coding agents, skills catalog included.
 *
 * @param packageManager - The manager named in the run command.
 * @param includeVibatorSkills - Whether vibator was selected, so its skills
 * belong in the catalog.
 * @returns Markdown lines to append to `AGENTS.md` or `CLAUDE.md`.
 */
export function agentsSection(
  packageManager: PackageManager,
  includeVibatorSkills: boolean,
): string[] {
  return [
    "",
    "## Vibator",
    "",
    `This repository is gated by ${GATE_PACKAGE}. Run the whole gate with`,
    `\`${packageManager} run verify\`. Fix findings at the source; never weaken`,
    "a gate to make it pass. The standards and the override recipes live in",
    `\`node_modules/${GATE_PACKAGE}/docs/standards.md\`; the thin configs in`,
    "this repository state only what differs. For machine-readable findings",
    "run `npx vibator --reporter json`.",
    ...GATE_SKILLS_CATALOG,
    ...(includeVibatorSkills ? VIBATOR_SKILLS_CATALOG : []),
  ];
}

/** The pre-commit line running Biome on staged files. */
export const BIOME_HOOK_LINE =
  "npx biome check --staged --no-errors-on-unmatched";

/** The pre-commit line running vibator's fast rules on staged files. */
export const VIBATOR_HOOK_LINE =
  "npx vibator --staged --only no-conflict-markers,max-file-size,no-dead-doc-links";

/** The commit-msg line linting the message. */
export const COMMITLINT_HOOK_LINE = 'npx commitlint --edit "$1"';
