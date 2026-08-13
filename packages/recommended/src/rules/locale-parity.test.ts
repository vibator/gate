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

/** The source locale the others are compared against. */
const ENGLISH = `{
  "title": "Title",
  "actions": {
    "save": "Save",
    "delete": "Delete"
  }
}
`;

/** The translation with one missing and one extra key. */
const CATALAN = `{
  "title": "Títol",
  "actions": {
    "save": "Desa"
  },
  "footer": "Peu de pàgina"
}
`;

/** The configuration a throwaway project runs with. */
const CONFIG = {
  plugins: ["@vibator/recommended"],
  rules: {
    "locale-parity": {
      severity: "error",
      options: {
        root: "locales",
      },
    },
  },
};

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
  const root = mkdtempSync(join(tmpdir(), "vibator-recommended-"));
  roots.push(root);
  symlinkSync(nodeModules, join(root, "node_modules"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe("the locale-parity rule over a throwaway project", () => {
  it("reports missing and extra keys against the source locale", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      ".vibator.json": JSON.stringify(CONFIG),
      "locales/en/common.json": ENGLISH,
      "locales/ca/common.json": CATALAN,
    });
    const { findings, exitCode } = await run({ root, only: ["locale-parity"] });

    expect(exitCode).toBe(1);
    expect(findings).toHaveLength(2);
    expect(
      findings.every((finding) => finding.file === "locales/ca/common.json"),
    ).toBe(true);

    const missing = findings.find((finding) =>
      finding.message.includes("missing"),
    );
    expect(missing?.message).toBe(
      "1 key(s) missing vs en/common.json: actions.delete",
    );
    expect(missing?.fix).toContain("Add the missing keys");

    const extra = findings.find((finding) =>
      finding.message.includes("absent"),
    );
    expect(extra?.message).toBe("1 key(s) absent from en/common.json: footer");
  });
});
