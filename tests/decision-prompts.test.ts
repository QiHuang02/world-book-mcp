import { describe, expect, it } from "vitest";
import { clearUserDecision, getUserDecision, listUserDecisions, recordUserDecision, requestUserDecision } from "../src/core/decision-prompts.js";
import type { Project } from "../src/schemas/project.js";

function emptyProject(): Project {
  return {
    id: "project_test",
    name: "测试",
    patches: [],
    pendingDecisions: [],
    recordedDecisions: [],
    revision: 1,
    characterCardPatches: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("decision-prompts", () => {
  it("requestUserDecision writes pending and renders prompt", () => {
    const result = requestUserDecision(emptyProject(), {
      id: "card_type",
      question: "卡型？",
      options: [{ value: "single", label: "单角色卡", is_recommended: true }, { value: "multi", label: "多角色卡" }],
      source_tool: "skill.task-routing",
    });
    expect(result.project.pendingDecisions).toHaveLength(1);
    expect(result.prompt_text).toContain("卡型？");
    expect(result.prompt_text).toContain("[single]");
    expect(result.prompt_text).toContain("推荐");
    expect(result.prompt_text).toContain("单一主题");
    expect(result.prompt_text).toContain("不要把多个独立主题合并");
  });

  it("renders guidance for complex multi-round topics and MVU variables", () => {
    const result = requestUserDecision(emptyProject(), {
      id: "mvu_variable_goal",
      question: "MVU 变量主要服务什么玩法？",
      options: [{ value: "romance", label: "恋爱互动" }, { value: "adventure", label: "冒险探索" }],
      source_tool: "skill.mvu-routing",
    });
    expect(result.prompt_text).toContain("至少三轮追问");
    expect(result.prompt_text).toContain("MVU 变量设计");
    expect(result.prompt_text).toContain("用途目标");
    expect(result.prompt_text).toContain("变量清单");
    expect(result.prompt_text).toContain("变量规格/初始值/更新条件");
  });

  it("recordUserDecision moves entry from pending to recorded", () => {
    const requested = requestUserDecision(emptyProject(), {
      id: "card_type",
      question: "卡型？",
      options: [{ value: "single", label: "单角色卡" }, { value: "multi", label: "多角色卡" }],
      allow_custom: false,
      source_tool: "skill.task-routing",
    });
    const recorded = recordUserDecision(requested.project, { id: "card_type", selected_values: ["multi"] });
    expect(recorded.project.pendingDecisions).toHaveLength(0);
    expect(recorded.project.recordedDecisions[0].selected_values).toEqual(["multi"]);
    expect(recorded.project.recordedDecisions[0].source_tool).toBe("skill.task-routing");
    expect(recorded).not.toHaveProperty("recommended_next_tool");
    expect(getUserDecision(recorded.project, "card_type")?.id).toBe("card_type");
  });

  it("rejects illegal value when custom is disabled", () => {
    const requested = requestUserDecision(emptyProject(), {
      id: "card_type",
      question: "卡型？",
      options: [{ value: "single", label: "单角色卡" }],
      allow_custom: false,
    });
    expect(() => recordUserDecision(requested.project, { id: "card_type", selected_values: ["other"] })).toThrow();
  });

  it("clearUserDecision removes both pending and recorded", () => {
    const requested = requestUserDecision(emptyProject(), { id: "x", question: "?" });
    const recorded = recordUserDecision(requested.project, { id: "x", selected_values: [], custom_text: "free" });
    const cleared = clearUserDecision(recorded.project, "x");
    expect(cleared.cleared_recorded).toBe(true);
    expect(cleared.project.recordedDecisions).toHaveLength(0);
    expect(listUserDecisions(cleared.project).pending).toHaveLength(0);
  });
});
