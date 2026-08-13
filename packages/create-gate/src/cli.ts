#!/usr/bin/env node
/**
 * The create-gate binary: asks which gates the project wants and writes them.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  note,
  outro,
} from "@clack/prompts";
import { apply } from "./apply.ts";
import { type Answers, plan, type ToolChoices } from "./plan.ts";

/**
 * Cancels the run with a message.
 *
 * @param message - The reason shown to the user.
 */
function fail(message: string): never {
  cancel(message);
  process.exit(1);
}

/**
 * Refuses roots the wizard cannot set up.
 *
 * @param root - The absolute project root.
 */
function guard(root: string): void {
  if (!existsSync(join(root, "package.json"))) {
    fail("No package.json here. Run npm init first.");
  }
  if (existsSync(join(root, ".vibator.json"))) {
    fail("A .vibator.json already exists. Remove it to run the wizard again.");
  }
}

/**
 * Asks which gates the project wants.
 *
 * @returns The chosen gates.
 */
async function askTools(): Promise<ToolChoices> {
  const picked = await multiselect({
    message: "Which gates do you want?",
    options: [
      { value: "biome", label: "Biome", hint: "format and lint" },
      { value: "knip", label: "Knip", hint: "unused code and dependencies" },
      {
        value: "depcruise",
        label: "dependency-cruiser",
        hint: "dependency graph rules",
      },
      {
        value: "recommended",
        label: "Recommended rules",
        hint: "general-purpose vibator rules",
      },
    ],
    initialValues: ["biome", "knip", "depcruise", "recommended"],
    required: true,
  });
  if (isCancel(picked)) fail("Cancelled.");
  return {
    biome: picked.includes("biome"),
    knip: picked.includes("knip"),
    depcruise: picked.includes("depcruise"),
    recommended: picked.includes("recommended"),
  };
}

/**
 * Asks whether to create a tsconfig extending the gate preset. A project
 * that already has a tsconfig.json is left alone.
 *
 * @param root - The absolute project root.
 * @returns Whether to write the tsconfig.
 */
async function askTsconfig(root: string): Promise<boolean> {
  if (existsSync(join(root, "tsconfig.json"))) return false;
  const answer = await confirm({
    message: "Create a tsconfig.json extending the gate preset?",
  });
  if (isCancel(answer)) fail("Cancelled.");
  return answer;
}

/**
 * Runs the wizard against the current working directory.
 */
async function main(): Promise<void> {
  const root = process.cwd();
  intro("create-gate");
  guard(root);
  const answers: Answers = {
    tools: await askTools(),
    tsconfig: await askTsconfig(root),
  };
  const written = apply(plan(answers), root);
  note([...written, "package.json"].join("\n"), "Written");
  outro("Run your package manager's install, then npx vibator.");
}

await main();
