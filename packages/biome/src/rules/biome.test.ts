import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "vibator";
import { afterAll, describe, expect, it } from "vitest";

/** The workspace node_modules, linked into each throwaway project. */
const nodeModules = fileURLToPath(
  new URL("../../../../node_modules", import.meta.url),
);

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/**
 * Creates a throwaway project with the given files and the workspace
 * node_modules linked.
 *
 * @param files - The files keyed by root-relative path.
 * @returns The absolute project root.
 */
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "vibator-biome-"));
  roots.push(root);
  symlinkSync(nodeModules, join(root, "node_modules"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

/**
 * A `.vibator.json` running only the biome rule with the given options.
 *
 * @param options - The rule options.
 * @returns The config file content.
 */
function config(options: Record<string, unknown>): string {
  return JSON.stringify({
    plugins: ["@vibator/biome"],
    rules: { biome: { options } },
  });
}

/** A source file with a `==` comparison and an unused variable. */
const SAMPLE = `export function greet(name: string): string {
  let message = \`Hello, \${name}\`;
  if (name == "admin") {
    return \`Welcome back, \${name}\`;
  }
  return message;
}

const unused = 42;
`;

/** A source file with a default export, a console call, and a negated if. */
const GREETER = `export default function greet(flag: boolean): string {
  if (!flag) {
    console.log("hi");
    return "off";
  } else {
    return "on";
  }
}
`;

/** A Biome configuration enabling the unused-variables check. */
const BIOME_CONFIG = `{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error"
      }
    }
  }
}
`;

describe("the biome rule", () => {
  it("maps Biome's findings to vibator diagnostics", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      "sample.ts": SAMPLE,
      "biome.json": BIOME_CONFIG,
      ".vibator.json": config({ configPath: "./biome.json" }),
    });
    const { findings, exitCode } = await run({ root, only: ["biome"] });

    expect(exitCode).toBe(1);
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.every((finding) => finding.ruleId === "biome")).toBe(true);
    expect(findings.every((finding) => finding.file === "sample.ts")).toBe(
      true,
    );

    const unused = findings.find((finding) =>
      finding.message.includes("lint/correctness/noUnusedVariables"),
    );
    expect(unused).toBeDefined();
    expect(unused?.line).toBe(9);
    expect(unused?.expected).toContain("noUnusedVariables");

    const doubleEquals = findings.find((finding) =>
      finding.message.includes("lint/suspicious/noDoubleEquals"),
    );
    expect(doubleEquals).toBeDefined();
    expect(doubleEquals?.line).toBe(3);
  });

  it("loads a configuration from a package:path reference", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      "sample.ts": SAMPLE,
      ".vibator.json": config({
        configPath: "@vibator/gate:biome.base.json",
      }),
    });
    const { findings, exitCode } = await run({ root, only: ["biome"] });

    expect(exitCode).toBe(1);
    expect(
      findings.some((finding) =>
        finding.message.includes("lint/suspicious/noDoubleEquals"),
      ),
    ).toBe(true);
    expect(
      findings.some((finding) =>
        finding.message.includes("configuration could not be loaded"),
      ),
    ).toBe(false);
  });

  it("flattens the extends chain of the configuration file", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      "greeter.ts": GREETER,
      "strict.json":
        '{"linter":{"rules":{"style":{"noNegationElse":"error"}}}}',
      "biome-extends.json":
        '{"extends":["./strict.json","@vibator/gate/biome"],"linter":{"rules":{"style":{"noDefaultExport":"error"}}}}',
      ".vibator.json": config({ configPath: "./biome-extends.json" }),
    });
    const { findings, exitCode } = await run({ root, only: ["biome"] });

    expect(exitCode).toBe(1);
    const messages = findings.map((finding) => finding.message);
    expect(messages.some((m) => m.includes("noNegationElse"))).toBe(true);
    expect(messages.some((m) => m.includes("noConsole"))).toBe(true);
    expect(messages.some((m) => m.includes("noDefaultExport"))).toBe(true);
  });

  it("reports a project-level finding when a package:path names no file", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      "sample.ts": SAMPLE,
      ".vibator.json": config({ configPath: "@vibator/gate:absent.json" }),
    });
    const { findings, exitCode } = await run({ root, only: ["biome"] });

    expect(exitCode).toBe(1);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toMatch(
      /Biome configuration could not be loaded/,
    );
    expect(findings[0]?.message).toContain("@vibator/gate:absent.json");
  });

  it("reports a project-level finding when configPath names no file", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      "sample.ts": SAMPLE,
      ".vibator.json": config({ configPath: "./missing-biome.json" }),
    });
    const { findings, exitCode } = await run({ root, only: ["biome"] });

    expect(exitCode).toBe(1);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toMatch(
      /Biome configuration could not be loaded/,
    );
    expect(findings[0]?.file).toBeUndefined();
  });
});
