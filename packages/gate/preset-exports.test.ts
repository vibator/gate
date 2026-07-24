import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Absolute path of the gate package root. */
const packageRoot = dirname(fileURLToPath(import.meta.url));

/** The gate package manifest. */
const manifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
) as { exports: Record<string, string>; files: string[] };

describe("@vibator/gate exports", () => {
  it("maps every export subpath to a file that exists", () => {
    const targets = Object.values(manifest.exports).filter(
      (target) => !target.includes("*"),
    );
    expect(targets.length).toBeGreaterThan(0);
    targets.forEach((target) => {
      expect(existsSync(join(packageRoot, target)), target).toBe(true);
    });
  });

  it("ships every exported file in the published package", () => {
    const shipped = Object.values(manifest.exports)
      .filter((target) => !target.includes("*"))
      .filter((target) => target !== "./package.json")
      .map((target) => target.replace("./", ""));
    shipped.forEach((file) => {
      expect(manifest.files, file).toContain(file);
    });
  });

  it("ships the documents and skills the presets point at", () => {
    expect(existsSync(join(packageRoot, "docs", "standards.md"))).toBe(true);
    expect(
      existsSync(
        join(packageRoot, "skills", "using-the-vibator-gate", "SKILL.md"),
      ),
    ).toBe(true);
  });

  it("keeps the JSON presets parseable", () => {
    const jsonPresets = ["biome.base.json", "vibator.json", "tsconfig.json"];
    jsonPresets.forEach((preset) => {
      const parsed = JSON.parse(
        readFileSync(join(packageRoot, preset), "utf8"),
      ) as object;
      expect(parsed, preset).toBeTypeOf("object");
    });
  });
});
