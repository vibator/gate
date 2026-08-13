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

/** The demo service the rule reports. */
const SERVICE = `/** The demo service the banned-patterns rule reports. */
import axios from "axios";

// vibator-ignore banned-patterns: the demo proves the line marker works
import allowed from "axios";

export function fetchUsers(): Promise<unknown> {
  return axios.get("/users").then(() => allowed);
}
`;

/** The configuration a throwaway project runs with. */
const CONFIG = {
  plugins: ["@vibator/recommended"],
  rules: {
    "banned-patterns": {
      severity: "error",
      options: {
        include: ["src/**"],
        patterns: [
          {
            pattern: 'from "axios"',
            message: "Imports axios directly",
            expected: "HTTP goes through the shared client",
            fix: "Import the client from the api module instead",
          },
        ],
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

describe("the banned-patterns rule over a throwaway project", () => {
  it("reports each match with the pattern's own diagnostic text", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      ".vibator.json": JSON.stringify(CONFIG),
      "src/service.ts": SERVICE,
    });
    const { findings, exitCode } = await run({
      root,
      only: ["banned-patterns"],
    });

    expect(exitCode).toBe(1);
    expect(findings).toHaveLength(1);
    const finding = findings[0];
    expect(finding?.ruleId).toBe("banned-patterns");
    expect(finding?.file).toBe("src/service.ts");
    expect(finding?.line).toBe(2);
    expect(finding?.message).toBe("Imports axios directly");
    expect(finding?.expected).toBe("HTTP goes through the shared client");
    expect(finding?.fix).toBe("Import the client from the api module instead");
  });
});
