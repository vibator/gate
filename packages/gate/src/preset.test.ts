import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

interface Manifest {
  exports: Record<string, string>;
  files: string[];
}

/**
 * Reads and parses a JSON file at the package root.
 *
 * @param name - The file name relative to the package root.
 * @returns The parsed value.
 */
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(packageRoot, name), "utf8")) as T;
}

const manifest = readJson<Manifest>("package.json");

describe("the gate preset files", () => {
  it("maps every export subpath to a file that exists", () => {
    const targets = Object.values(manifest.exports);
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(existsSync(join(packageRoot, target)), target).toBe(true);
    }
  });

  it("ships every exported file in the published package", () => {
    const shipped = Object.values(manifest.exports)
      .filter((target) => target !== "./package.json")
      .map((target) => target.replace("./", ""));
    for (const file of shipped) {
      expect(manifest.files, file).toContain(file);
    }
  });

  it("keeps the JSON presets parseable", () => {
    for (const name of ["biome.base.json", "tsconfig.json"]) {
      expect(readJson<object>(name), name).toBeTypeOf("object");
    }
  });
});
