import { describe, expect, it } from "vitest";
import { classifyWorldbookTaskWithClarification, detectClarificationNeeds } from "../src/core/clarification.js";

describe("clarification", () => {
  it("flags vague character card request with origin/card_type/worldbuilding decisions", () => {
    const result = classifyWorldbookTaskWithClarification({ request: "我想创建一个角色卡" });
    expect(result.task_type).toBe("original_character_card");
    expect(result.needs_clarification).toBe(true);
    const ids = result.suggested_decisions.map((decision) => decision.id);
    expect(ids).toContain("origin_type");
    expect(ids).toContain("card_type");
    expect(ids).toContain("worldbuilding_type");
    expect(result).not.toHaveProperty("recommended_next_tool");
  });

  it("derivative extraction asks for source kind and focus", () => {
    const result = classifyWorldbookTaskWithClarification({ request: "我想根据原作小说做二创世界书" });
    expect(result.task_type).toBe("derivative_extraction");
    const ids = result.suggested_decisions.map((decision) => decision.id);
    expect(ids).toContain("extraction_focus");
    expect(ids).not.toContain("origin_type");
  });

  it("post_classification stage skips origin question", () => {
    const result = detectClarificationNeeds({ request: "二创世界书", task_type: "derivative_extraction", stage: "post_classification" });
    const ids = result.suggested_decisions.map((decision) => decision.id);
    expect(ids).not.toContain("origin_type");
  });

  it("returns no clarification when intent is precise", () => {
    const result = classifyWorldbookTaskWithClarification({ request: "查看世界书 brief" });
    expect(result.task_type).toBe("query_existing");
    expect(result.needs_clarification).toBe(false);
    expect(result.suggested_decisions).toHaveLength(0);
  });

  it("forces decisions when prefer_user_decision is true", () => {
    const result = detectClarificationNeeds({ request: "查看世界书 brief", task_type: "query_existing" });
    expect(result.suggested_decisions).toHaveLength(0);
    const forced = detectClarificationNeeds({ request: "我要修改世界书", task_type: "modify_existing" });
    expect(forced.suggested_decisions.length).toBeGreaterThan(0);
  });
});
