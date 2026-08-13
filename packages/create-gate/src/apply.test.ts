import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import type { Plan } from "./plan.ts";

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Creates a temp project root with a package.json.
 *
 * @param manifest - The package.json content.
 * @returns The absolute root path.
 */
function project(manifest: object): string {
  const root = mkdtempSync(join(tmpdir(), "create-gate-"));
  writeFileSync(join(root, "package.json"), JSON.stringify(manifest));
  roots.push(root);
  return root;
}

const somePlan: Plan = {
  files: [
    { path: ".vibator.json", content: '{"plugins":[]}\n' },
    { path: ".vibator/biome.json", content: '{"extends":[]}\n' },
  ],
  devDependencies: { vibator: "^2.1.0", "@vibator/biome": "^1.0.0" },
};

describe("apply", () => {
  it("writes every planned file and the devDependencies", () => {
    const root = project({ name: "demo", devDependencies: { zod: "^4.0.0" } });
    const written = apply(somePlan, root);

    expect(written).toEqual([".vibator.json", ".vibator/biome.json"]);
    expect(existsSync(join(root, ".vibator/biome.json"))).toBe(true);
    const manifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { devDependencies: Record<string, string> };
    expect(Object.keys(manifest.devDependencies)).toEqual([
      "@vibator/biome",
      "vibator",
      "zod",
    ]);
  });

  it("keeps an already declared dependency version", () => {
    const root = project({ devDependencies: { vibator: "^9.9.9" } });
    apply(somePlan, root);
    const manifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { devDependencies: Record<string, string> };
    expect(manifest.devDependencies.vibator).toBe("^9.9.9");
  });

  it("refuses to overwrite an existing file", () => {
    const root = project({});
    writeFileSync(join(root, ".vibator.json"), "{}");
    expect(() => apply(somePlan, root)).toThrow(/already exists/);
  });

  it("refuses a root without a package.json", () => {
    const root = mkdtempSync(join(tmpdir(), "create-gate-empty-"));
    roots.push(root);
    expect(() => apply(somePlan, root)).toThrow(/package.json/);
  });
});
