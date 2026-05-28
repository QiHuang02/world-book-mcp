import { describe, expect, it } from "vitest";
import { createMvuTemplate } from "../src/core/mvu-template.js";

describe("createMvuTemplate", () => {
  it("creates zod mvu config", () => {
    const result = createMvuTemplate({ characterNames: ["角色A"] });
    expect(result.mvu.schemaScript).toContain("registerMvuSchema");
    expect(result.mvu.initvar).toContain("角色A");
    expect(result.mvu.updateRules).toContain("变量更新规则");
  });

  it("updateRules does not contain a leading YAML doc separator", () => {
    const result = createMvuTemplate({ characterNames: ["角色A"] });
    expect(result.mvu.updateRules.startsWith("---")).toBe(false);
    expect(result.mvu.updateRules.split(/\r?\n/)[0]).toBe("变量更新规则:");
  });
});
