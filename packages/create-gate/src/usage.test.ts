import { describe, expect, it } from "vitest";
import { usage } from "./usage.ts";

describe("usage", () => {
  it("names the command it documents and the given version", () => {
    const text = usage("1.2.3");
    expect(text).toContain("create-gate 1.2.3");
    expect(text).toContain("npm create @vibator/gate");
  });
});
