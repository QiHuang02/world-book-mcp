import { describe, expect, it } from "vitest";
import { createMvuTemplate } from "../src/core/mvu-template.js";

describe("createMvuTemplate", () => {
  it("creates zod mvu config", () => {
    const result = createMvuTemplate({ characterNames: ["角色A"] });
    expect(result.mvu.schema_script).toContain("registerMvuSchema");
    expect(result.mvu.initvar).toContain("角色A");
    expect(result.mvu.update_rules).toContain("变量更新规则");
  });
});
