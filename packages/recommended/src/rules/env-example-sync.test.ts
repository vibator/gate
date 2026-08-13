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

/** The configuration reader the rule scans. */
const APP = `/** The demo configuration reader the env-example-sync rule scans. */
const { PORT = "3000" } = process.env;

// A comment naming process.env.DOC_ONLY is prose, not a read.
export function apiUrl(): string {
  return \`\${process.env.API_URL}:\${PORT}\`;
}
`;

/** The example file the rule judges. */
const EXAMPLE = `# The demo example file the env-example-sync rule judges.
API_URL=https://api.example.test
# STALE_VAR=unused-default
`;

/** The configuration a throwaway project runs with. */
const CONFIG = {
  plugins: ["@vibator/recommended"],
  rules: {
    "env-example-sync": {
      options: {
        include: ["src/**/*.ts"],
        example: ".env.example",
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

describe("the env-example-sync rule over a throwaway project", () => {
  it("reports drift in both directions as warnings", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      ".vibator.json": JSON.stringify(CONFIG),
      "src/app.ts": APP,
      ".env.example": EXAMPLE,
    });
    const { findings, exitCode } = await run({
      root,
      only: ["env-example-sync"],
    });

    expect(exitCode).toBe(0);
    expect(findings).toHaveLength(2);
    expect(findings.every((finding) => finding.severity === "warn")).toBe(true);

    const undocumented = findings.find((finding) =>
      finding.message.startsWith("PORT"),
    );
    expect(undocumented?.message).toBe(
      "PORT is read by src/app.ts but not documented here",
    );
    expect(undocumented?.file).toBe(".env.example");

    const unread = findings.find((finding) =>
      finding.message.startsWith("STALE_VAR"),
    );
    expect(unread?.message).toBe(
      "STALE_VAR is documented here but read by no scanned source",
    );
    expect(unread?.line).toBe(3);
    expect(unread?.fix).toContain("externallyConsumed");
  });
});
