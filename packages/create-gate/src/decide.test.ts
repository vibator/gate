import { describe, expect, it } from "vitest";
import { buildPlan, forcedAnswers, recommend } from "./decide.ts";
import type { Answers, Snapshot } from "./plan.ts";

/**
 * A snapshot of a fresh TypeScript repository, overridable per test.
 *
 * @param overrides - Fields that differ from the fresh-repo baseline.
 * @returns The snapshot.
 */
function snapshotWith(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    root: "/repo",
    hasPackageJson: true,
    isGitRepository: true,
    packageManager: "npm",
    usesTypeScript: true,
    tsconfigExtendable: true,
    hasWorkspaces: false,
    hasSourceDirectory: true,
    scripts: {},
    installedPackages: [],
    configs: { tsconfig: "tsconfig.json" },
    hooks: { husky: false, lefthook: false, simpleGitHooks: false },
    hasQualityWorkflow: false,
    ...overrides,
  };
}

/**
 * The answers accepting every recommendation for a snapshot.
 *
 * @param snapshot - The snapshot to recommend from.
 * @param overrides - Answers that differ from the recommendation.
 * @returns The full answers.
 */
function answersFor(
  snapshot: Snapshot,
  overrides: Partial<Answers> = {},
): Answers {
  return { ...recommend(snapshot), ...overrides };
}

describe("recommend", () => {
  it("creates everything in a fresh repository", () => {
    const fresh = recommend(snapshotWith());
    expect(fresh.lint).toBe("create");
    expect(fresh.vibator).toBe("create");
    expect(fresh.depcruise).toBe(true);
    expect(fresh.tsconfig).toBe(true);
  });

  it("extends an existing biome config instead of creating one", () => {
    const snapshot = snapshotWith({ configs: { biome: "biome.json" } });
    expect(recommend(snapshot).lint).toBe("extend");
  });

  it("respects an existing eslint setup by default", () => {
    const snapshot = snapshotWith({ configs: { eslint: ".eslintrc.json" } });
    expect(recommend(snapshot).lint).toBe("skip");
  });
});

describe("forcedAnswers", () => {
  it("closes the questions the situation already answers", () => {
    const forced = forcedAnswers(
      snapshotWith({
        usesTypeScript: false,
        configs: {
          depcruise: ".dependency-cruiser.cjs",
          commitlint: "commitlint.config.mjs",
        },
        hasQualityWorkflow: true,
      }),
    );
    expect(forced).toEqual({
      tsconfig: false,
      commitlint: false,
      ci: false,
    });
  });

  it("forces nothing in a fresh TypeScript repository", () => {
    expect(forcedAnswers(snapshotWith())).toEqual({});
  });
});

describe("buildPlan", () => {
  it("plans thin configs, scripts and installs for a fresh repository", () => {
    const snapshot = snapshotWith();
    const plan = buildPlan(snapshot, answersFor(snapshot));

    expect(plan.creations.map((creation) => creation.path)).toEqual([
      "biome.json",
      ".dependency-cruiser.cjs",
      "vibator.json",
      ".commitlintrc.json",
      ".github/workflows/quality.yml",
    ]);
    expect(plan.scripts.verify).toBe(
      "biome check && knip && depcruise src --config .dependency-cruiser.cjs && vibator",
    );
    expect(plan.installs).toContain("@vibator/gate");
    expect(plan.installs).toContain("husky");
  });

  it("prepends extends to existing configs instead of creating files", () => {
    const snapshot = snapshotWith({
      configs: {
        biome: "biome.json",
        vibator: "vibator.json",
        tsconfig: "tsconfig.json",
      },
    });
    const plan = buildPlan(snapshot, answersFor(snapshot));

    const changed = plan.changes.map(
      (change) => `${change.kind}:${change.path}`,
    );
    expect(changed).toContain("prepend-extends:biome.json");
    expect(changed).toContain("prepend-extends:vibator.json");
    expect(plan.creations.map((creation) => creation.path)).not.toContain(
      "biome.json",
    );
  });

  it("routes hook lines to a note when another manager is in place", () => {
    const snapshot = snapshotWith({
      hooks: { husky: false, lefthook: true, simpleGitHooks: false },
    });
    const plan = buildPlan(snapshot, answersFor(snapshot));

    expect(
      plan.changes.some((change) => change.path.startsWith(".husky")),
    ).toBe(false);
    expect(plan.installs).not.toContain("husky");
    expect(plan.notes.join(" ")).toContain("other than husky");
  });

  it("disables the type-aware rule in the config written for a JS repo", () => {
    const snapshot = snapshotWith({
      usesTypeScript: false,
      tsconfigExtendable: false,
      configs: {},
    });
    const plan = buildPlan(snapshot, answersFor(snapshot, { tsconfig: false }));

    const vibator = plan.creations.find((c) => c.path === "vibator.json");
    expect(vibator?.contents).toContain('"no-deprecated-apis": "off"');
  });

  it("never plans installing what is already installed", () => {
    const snapshot = snapshotWith({
      installedPackages: ["@biomejs/biome", "knip", "@vibator/gate"],
    });
    const plan = buildPlan(snapshot, answersFor(snapshot));

    expect(plan.installs).not.toContain("@biomejs/biome");
    expect(plan.installs).not.toContain("knip");
    expect(plan.installs).not.toContain("@vibator/gate");
  });

  it("leaves a skipped depcruise config alone, without lobbying notes", () => {
    const snapshot = snapshotWith({
      configs: {
        tsconfig: "tsconfig.json",
        depcruise: ".dependency-cruiser.js",
      },
    });
    const answers = answersFor(snapshot, { depcruise: false });
    const plan = buildPlan(snapshot, answers);

    expect(plan.creations.map((c) => c.path)).not.toContain(
      ".dependency-cruiser.cjs",
    );
    expect(plan.scripts.verify).toContain("--config .dependency-cruiser.js");
    expect(plan.notes.join(" ")).not.toContain(".dependency-cruiser.js");
  });

  it("extends an existing JSON depcruise config in place", () => {
    const snapshot = snapshotWith({
      configs: {
        tsconfig: "tsconfig.json",
        depcruise: ".dependency-cruiser.json",
      },
    });
    const plan = buildPlan(snapshot, answersFor(snapshot));

    expect(plan.changes).toContainEqual({
      kind: "prepend-extends",
      path: ".dependency-cruiser.json",
      specifier: "@vibator/gate/depcruise",
    });
    expect(plan.installs).toContain("dependency-cruiser");
  });

  it("hands a JS depcruise config the exact extends line instead of editing code", () => {
    const snapshot = snapshotWith({
      configs: {
        tsconfig: "tsconfig.json",
        depcruise: ".dependency-cruiser.cjs",
      },
    });
    const plan = buildPlan(snapshot, answersFor(snapshot));

    expect(plan.changes.map((change) => change.path)).not.toContain(
      ".dependency-cruiser.cjs",
    );
    expect(plan.notes.join(" ")).toContain(
      'extends: "@vibator/gate/depcruise"',
    );
  });

  it("appends the gate section to CLAUDE.md only when it is the sole agent file", () => {
    const snapshot = snapshotWith({ agentsFile: "CLAUDE.md" });
    const plan = buildPlan(snapshot, answersFor(snapshot));

    const change = plan.changes.find((entry) => entry.path === "CLAUDE.md");
    expect(change?.kind).toBe("append-lines");
    expect(change?.lines?.join(" ")).toContain("## Vibator");
  });

  it("catalogues the skills in the agents section without installing them", () => {
    const snapshot = snapshotWith();
    const plan = buildPlan(snapshot, answersFor(snapshot));

    const section = plan.changes.find((entry) => entry.path === "AGENTS.md");
    const catalogue = section?.lines?.join("\n") ?? "";
    expect(catalogue).toContain("using-the-vibator-gate");
    expect(catalogue).toContain("configuring-vibator");
    expect(catalogue).toContain("npx vibator skills --install");
  });

  it("keeps vibator's skills out of the catalogue when vibator is skipped", () => {
    const snapshot = snapshotWith();
    const plan = buildPlan(snapshot, answersFor(snapshot, { vibator: "skip" }));

    const section = plan.changes.find((entry) => entry.path === "AGENTS.md");
    const catalogue = section?.lines?.join("\n") ?? "";
    expect(catalogue).toContain("using-the-vibator-gate");
    expect(catalogue).not.toContain("configuring-vibator");
  });

  it("points at biome migrate when Biome is created next to Prettier", () => {
    const snapshot = snapshotWith({
      configs: { tsconfig: "tsconfig.json", prettier: ".prettierrc.json" },
    });
    const plan = buildPlan(snapshot, answersFor(snapshot, { lint: "create" }));

    expect(plan.creations.map((c) => c.path)).toContain("biome.json");
    expect(plan.followUps).toHaveLength(1);
    expect(plan.followUps[0]?.kind).toBe("command");
    expect(plan.followUps[0]?.command).toBe(
      "npx biome migrate prettier --write",
    );
    expect(plan.notes.join(" ")).not.toContain("biome migrate");
  });

  it("warns when the target is not a git repository", () => {
    const snapshot = snapshotWith({ isGitRepository: false });
    const plan = buildPlan(snapshot, answersFor(snapshot));
    expect(plan.notes.join(" ")).toContain("git init");
  });
});
