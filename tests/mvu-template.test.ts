import { describe, expect, it } from "vitest";
import { mvuContentFromEntries } from "../src/core/mvu-entry-templates.js";
import { createMvuTemplate } from "../src/core/mvu-template.js";

describe("createMvuTemplate", () => {
  it("creates runtime config plus real MVU system entries", () => {
    const result = createMvuTemplate({ characterNames: ["角色A"] });
    const content = mvuContentFromEntries(result.entries);
    expect(result.mvu.schemaScript).toContain("registerMvuSchema");
    expect(result.mvu).not.toHaveProperty("initvar");
    expect(result.mvu).not.toHaveProperty("updateRules");
    expect(content.initvar).toContain("角色A");
    expect(content.updateRules).toContain("变量更新规则");
  });

  it("update rules entry does not contain a leading YAML doc separator", () => {
    const result = createMvuTemplate({ characterNames: ["角色A"] });
    const content = mvuContentFromEntries(result.entries);
    expect(content.updateRules.startsWith("---")).toBe(false);
    expect(content.updateRules.split(/\r?\n/)[0]).toBe("变量更新规则:");
  });
});
