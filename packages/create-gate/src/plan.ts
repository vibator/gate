/**
 * Turns the wizard answers into the files and dependencies to write.
 *
 * @packageDocumentation
 */
import { createRequire } from "node:module";

/** The gates the wizard offers. */
export interface ToolChoices {
  /** The `biome` rule with the gate's Biome preset. */
  biome: boolean;
  /** The `knip` rule with zero-config discovery. */
  knip: boolean;
  /** The `depcruise` rule with the gate's universal ruleset. */
  depcruise: boolean;
  /** The recommended general-purpose rules. */
  recommended: boolean;
}

/** Everything the wizard asked. */
export interface Answers {
  /** The chosen gates. */
  tools: ToolChoices;
  /** Whether to create a tsconfig.json extending the gate preset. */
  tsconfig: boolean;
}

/** One file the wizard writes. */
interface PlannedFile {
  /** The path relative to the project root. */
  path: string;
  /** The full file content. */
  content: string;
}

/** The files and dependencies one wizard run produces. */
export interface Plan {
  /** The files to write, in order. */
  files: PlannedFile[];
  /** The devDependencies the project needs. */
  devDependencies: Record<string, string>;
}

/** The version range written for each installed package, declared as the
 * optional peerDependencies of this package's own manifest. */
const VERSIONS: Record<string, string> = (
  createRequire(import.meta.url)("../package.json") as {
    peerDependencies: Record<string, string>;
  }
).peerDependencies;

/** The recommended rules with the gate's default scopes. */
const RECOMMENDED_RULES: Record<string, object> = {
  "no-conflict-markers": {},
  "no-dead-doc-links": {},
  "tsdoc-coverage": { options: { include: ["src/**/*.{ts,tsx}"] } },
  "meaningful-names": { options: { include: ["src/**/*.{ts,tsx,js,jsx}"] } },
  "prefer-array-methods": {
    options: { include: ["src/**/*.{ts,tsx,js,jsx}"] },
  },
  "no-deprecated-apis": { options: { include: ["src/**/*.{ts,tsx}"] } },
  "env-example-sync": { options: { include: ["src/**/*.{ts,tsx,js,jsx}"] } },
};

/**
 * Serializes a configuration object to a JSON file content.
 *
 * @param value - The configuration.
 * @returns The formatted JSON with a trailing newline.
 */
function toJson(value: object): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * The rules section of the generated `.vibator.json`.
 *
 * @param tools - The chosen gates.
 * @returns The rules keyed by rule id.
 */
function ruleEntries(tools: ToolChoices): Record<string, object> {
  const rules: Record<string, object> = {};
  if (tools.biome) {
    rules.biome = {
      options: { configPath: ".vibator/biome.json", exclude: [] },
    };
  }
  if (tools.knip) rules.knip = {};
  if (tools.depcruise) {
    rules.depcruise = { options: { configPath: ".vibator/depcruise.cjs" } };
  }
  if (tools.recommended) Object.assign(rules, RECOMMENDED_RULES);
  return rules;
}

/**
 * The generated `.vibator.json` content.
 *
 * @param tools - The chosen gates.
 * @returns The file content.
 */
function vibatorConfig(tools: ToolChoices): string {
  const names = ["biome", "knip", "depcruise", "recommended"] as const;
  const plugins = names
    .filter((name) => tools[name])
    .map((name) => `@vibator/${name}`);
  return toJson({
    $schema: "node_modules/vibator/schema.json",
    plugins,
    rules: ruleEntries(tools),
  });
}

/** The generated `.vibator/depcruise.cjs` content. */
const DEPCRUISE_THIN = `/**
 * Dependency rules for this project. Layer boundaries go under \`forbidden\`;
 * the gate preset carries the universal rules.
 */
module.exports = {
  extends: "@vibator/gate/depcruise",
};
`;

/**
 * The configuration files the chosen gates need.
 *
 * @param answers - The wizard answers.
 * @returns The files to write, `.vibator.json` first.
 */
function plannedFiles(answers: Answers): PlannedFile[] {
  const files: PlannedFile[] = [
    { path: ".vibator.json", content: vibatorConfig(answers.tools) },
  ];
  if (answers.tools.biome) {
    files.push({
      path: ".vibator/biome.json",
      content: toJson({ extends: ["@vibator/gate/biome"] }),
    });
  }
  if (answers.tools.depcruise) {
    files.push({ path: ".vibator/depcruise.cjs", content: DEPCRUISE_THIN });
  }
  if (answers.tsconfig) {
    files.push({
      path: "tsconfig.json",
      content: toJson({ extends: "@vibator/gate/tsconfig" }),
    });
  }
  return files;
}

/**
 * The devDependencies the chosen gates need: vibator, the gate when one of
 * its presets is referenced, and one plugin per chosen gate.
 *
 * @param answers - The wizard answers.
 * @returns The dependencies keyed by package name.
 */
function devDependencies(answers: Answers): Record<string, string> {
  const { tools } = answers;
  const names = ["vibator"];
  if (tools.biome || tools.depcruise || answers.tsconfig) {
    names.push("@vibator/gate");
  }
  for (const name of ["biome", "knip", "depcruise", "recommended"] as const) {
    if (tools[name]) names.push(`@vibator/${name}`);
  }
  return Object.fromEntries(names.map((name) => [name, VERSIONS[name] ?? ""]));
}

/**
 * Turns the wizard answers into the plan to apply.
 *
 * @param answers - The wizard answers.
 * @returns The files and dependencies to write.
 */
export function plan(answers: Answers): Plan {
  return {
    files: plannedFiles(answers),
    devDependencies: devDependencies(answers),
  };
}
