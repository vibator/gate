import { describe, expect, it } from "vitest";
import { parseCli, reproduceCommand } from "./arguments.ts";
import type { Answers } from "./plan.ts";

describe("parseCli", () => {
  it("separates flow flags from choice answers", () => {
    const request = parseCli([
      "--defaults",
      "--dry-run",
      "--skip-install",
      "--dir",
      "/somewhere",
      "--lint=extend",
      "--knip=skip",
    ]);

    expect(request.defaults).toBe(true);
    expect(request.dryRun).toBe(true);
    expect(request.skipInstall).toBe(true);
    expect(request.dir).toBe("/somewhere");
    expect(request.answers).toEqual({ lint: "extend", knip: false });
  });

  it("parses the migrations consent flag, unset when absent", () => {
    expect(parseCli(["--migrations=yes"]).migrations).toBe(true);
    expect(parseCli(["--migrations=skip"]).migrations).toBe(false);
    expect(parseCli([]).migrations).toBeUndefined();
  });

  it("treats --yes as --defaults", () => {
    expect(parseCli(["--yes"]).defaults).toBe(true);
  });

  it("rejects a value outside a flag's accepted set", () => {
    expect(() => parseCli(["--lint=maybe"])).toThrow(/--lint accepts/);
  });

  it("rejects an unknown flag", () => {
    expect(() => parseCli(["--frobnicate"])).toThrow();
  });
});

describe("reproduceCommand", () => {
  it("states every choice as a flag", () => {
    const answers: Answers = {
      lint: "extend",
      knip: true,
      depcruise: false,
      vibator: "create",
      tsconfig: true,
      hooks: false,
      commitlint: true,
      ci: false,
      agents: true,
    };

    const command = reproduceCommand(answers);
    expect(command).toContain("--lint=extend");
    expect(command).toContain("--depcruise=skip");
    expect(command).toContain("--hooks=skip");
    expect(command).toContain("--agents=yes");
    // The reproduced run must itself parse.
    expect(() => parseCli(command.split(" ").slice(2))).not.toThrow();
  });
});
