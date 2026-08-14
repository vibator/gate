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
import "./no-deprecated-apis.ts";

/** The workspace node_modules, linked into each throwaway project. */
const nodeModules = fileURLToPath(
  new URL("../../../../node_modules", import.meta.url),
);

/** The module importing and calling the deprecated symbol. */
const APP = `/** The demo module the no-deprecated-apis rule judges. */
import { shout } from "./legacy.ts";

export function greet(name: string): string {
  return shout(name);
}
`;

/** The module declaring one deprecated and one current function. */
const LEGACY = `/**
 * Shouts a message.
 *
 * @deprecated Use speak instead.
 * @param message - The message to shout.
 * @returns The shouted message.
 */
export function shout(message: string): string {
  return message.toUpperCase();
}

/**
 * Speaks a message.
 *
 * @param message - The message to speak.
 * @returns The spoken message.
 */
export function speak(message: string): string {
  return message;
}
`;

/** The tsconfig the rule builds its program from. */
const TSCONFIG = `{
  "compilerOptions": {
    "target": "es2023",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["*.ts"]
}
`;

/** The configuration a throwaway project runs with. */
const CONFIG = {
  rules: {
    "no-deprecated-apis": {
      options: {
        include: ["src/**"],
        projects: ["src/tsconfig.json"],
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

describe("the no-deprecated-apis rule over a throwaway project", () => {
  it("reports the import and the call reaching a deprecated symbol", async () => {
    const root = project({
      "package.json": '{"name":"probe","type":"module"}',
      ".vibator.json": JSON.stringify(CONFIG),
      "src/app.ts": APP,
      "src/legacy.ts": LEGACY,
      "src/tsconfig.json": TSCONFIG,
    });
    const { findings, exitCode } = await run({
      root,
      only: ["no-deprecated-apis"],
    });

    expect(exitCode).toBe(1);
    expect(findings).toHaveLength(2);
    expect(findings.every((finding) => finding.file === "src/app.ts")).toBe(
      true,
    );
    expect(
      findings.every((finding) => finding.message === "shout is deprecated"),
    ).toBe(true);
    expect(
      findings.every((finding) => finding.expected === "Use speak instead."),
    ).toBe(true);
    expect(
      findings.every(
        (finding) => finding.fix === "Replace shout: Use speak instead.",
      ),
    ).toBe(true);
    expect(findings.map((finding) => finding.line).sort()).toEqual([2, 5]);
  });
});
