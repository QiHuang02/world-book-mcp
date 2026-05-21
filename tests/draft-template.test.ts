import { describe, expect, it } from "vitest";
import { createDraftTemplate } from "../src/core/draft-template.js";
import type { WorldbookEntryPlan } from "../src/schemas/worldbook-draft.js";

const plan: WorldbookEntryPlan[] = [
  {
    comment: "角色A_基础设定",
    entryType: "character_basic",
    position: "after_char",
    order: 10,
    constant: false,
    keys: ["角色A"],
    reason: "测试",
  },
];

describe("createDraftTemplate", () => {
  it("converts plan to fillable draft entries", () => {
    const draft = createDraftTemplate(plan);
    expect(draft[0].comment).toBe("角色A_基础设定");
    expect(draft[0].content).toContain("<character>");
    expect(draft[0].scanDepth).toBe(2);
    expect(draft[0].preventRecursion).toBe(true);
    expect(draft[0].excludeRecursion).toBe(true);
  });
});
