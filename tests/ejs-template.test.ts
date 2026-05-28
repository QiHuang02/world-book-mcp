import { describe, expect, it } from "vitest";
import { createEjsTemplate } from "../src/core/ejs-template.js";

describe("createEjsTemplate", () => {
  it("creates phase profile entries", () => {
    const result = createEjsTemplate({ templateType: "phase_profile", characterName: "角色A" });
    expect(result.ejs.entries.flatMap((entry) => entry.variablePaths)[0]).toContain("stat_data");
    expect(result.ejs.entries.some((entry) => entry.role === "controller")).toBe(true);
    expect(result.ejs.entries.some((entry) => entry.role === "stage" && !entry.enabled)).toBe(true);
  });
});
