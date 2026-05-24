import { describe, expect, it } from "vitest";
import { createDeliveryChecklist } from "../src/core/delivery-checklist.js";
import type { Project } from "../src/schemas/project.js";

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project_test",
    name: "测试",
    pendingDecisions: [],
    recordedDecisions: [],
    revision: 0,
    plan: { enabled_assets: {} },
    imports: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("createDeliveryChecklist", () => {
  it("blocks worldbook export when draft missing", () => {
    const result = createDeliveryChecklist({ project: baseProject(), export_target: "worldbook" });
    expect(result.ready_to_export).toBe(false);
    expect(result.items.some((item) => item.section === "worldbook_draft" && item.status === "blocking")).toBe(true);
  });

  it("blocks character card export when card config missing", () => {
    const project = baseProject({
      draft: [{
        comment: "条目",
        entryType: "other",
        keys: ["条目"],
        secondaryKeys: [],
        content: "<entry>\nname: 条目\ncontent: 测试\n</entry>",
        constant: false,
        position: "after_char",
        order: 1,
        enabled: true,
        scanDepth: 2,
        preventRecursion: true,
        excludeRecursion: true,
      }],
    });
    const result = createDeliveryChecklist({ project, export_target: "character_card" });
    expect(result.items.some((item) => item.section === "character_card" && item.status === "blocking")).toBe(true);
  });

  it("blocks export when there are pending decisions", () => {
    const project = baseProject({
      pendingDecisions: [{
        id: "card_type",
        question: "卡型？",
        options: [],
        allow_custom: true,
        multiple: false,
        created_at: "2026-01-01T00:00:00.000Z",
      }],
    });
    const result = createDeliveryChecklist({ project, export_target: "worldbook" });
    expect(result.items.some((item) => item.section === "pending_decisions" && item.status === "blocking")).toBe(true);
    expect(result.ready_to_export).toBe(false);
  });
});
