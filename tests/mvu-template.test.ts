import { describe, expect, it } from "vitest";
import { createMvuTemplate } from "../src/core/mvu-template.js";

describe("createMvuTemplate", () => {
  it("creates zod mvu config", () => {
    const result = createMvuTemplate({ characterNames: ["角色A"] });
    expect(result.mvu.schema_script).toContain("registerMvuSchema");
    expect(result.mvu.initvar).toContain("角色A");
    expect(result.mvu.update_rules).toContain("变量更新规则");
  });

  it("update_rules does not contain a leading YAML doc separator", () => {
    const result = createMvuTemplate({ characterNames: ["角色A"] });
    expect(result.mvu.update_rules.startsWith("---")).toBe(false);
    expect(result.mvu.update_rules.split(/\r?\n/)[0]).toBe("变量更新规则:");
  });
});
