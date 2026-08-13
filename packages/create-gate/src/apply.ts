/**
 * Writes a plan to a project: the files and the package.json dependencies.
 *
 * @packageDocumentation
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Plan } from "./plan.ts";

/**
 * Adds the plan's devDependencies to the project manifest, keeping versions
 * that are already declared and sorting the section by name.
 *
 * @param root - The absolute project root.
 * @param dependencies - The dependencies the plan needs.
 * @throws When the root has no package.json.
 */
function addDevDependencies(
  root: string,
  dependencies: Record<string, string>,
): void {
  const path = join(root, "package.json");
  if (!existsSync(path)) {
    throw new Error(`no package.json at ${root}; run npm init first`);
  }
  const manifest = JSON.parse(readFileSync(path, "utf8")) as {
    devDependencies?: Record<string, string>;
  };
  const merged = { ...dependencies, ...manifest.devDependencies };
  manifest.devDependencies = Object.fromEntries(
    Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Writes every planned file and the devDependencies to the project.
 * Existing files are never overwritten.
 *
 * @param plan - The plan to apply.
 * @param root - The absolute project root.
 * @returns The root-relative paths of the written files.
 * @throws When a planned file already exists or the root has no
 * package.json.
 */
export function apply(plan: Plan, root: string): string[] {
  for (const file of plan.files) {
    if (existsSync(join(root, file.path))) {
      throw new Error(`${file.path} already exists`);
    }
  }
  addDevDependencies(root, plan.devDependencies);
  for (const file of plan.files) {
    const target = join(root, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content);
  }
  return plan.files.map((file) => file.path);
}
