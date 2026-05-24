import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCharacterCardJsonFromProject } from "../src/core/character-card-project-builder.js";
import { createDeliveryChecklist } from "../src/core/delivery-checklist.js";
import { resolveCharacterCardOutputPath, resolveWorldbookOutputPath } from "../src/tools/export-tools.js";
import { ROOT_DIR } from "../src/storage/path-policy.js";
import type { Project } from "../src/schemas/project.js";

function projectWithCard(overrides: Partial<Project> = {}): Project {
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
    characterCardConfig: {
      card: {
        name: "角色A",
        description: "",
        personality: "",
        scenario: "",
        first_mes: "夜里，角色A站在门口。",
        alternate_greetings: ["雨声落在窗边。", "远处传来钟声。"],
        creator_notes: "",
        system_prompt: "",
        post_history_instructions: "",
        tags: [],
        creator: "",
        character_version: "1.0",
        talkativeness: "0.5",
      },
      worldbook: { source: "none" },
    },
    ...overrides,
  };
}

describe("export tools output path resolution", () => {
  it("uses the imported worldbook path when no explicit output path is provided", () => {
    const importedPath = path.resolve(ROOT_DIR, "模板世界书.json");

    const outputPath = resolveWorldbookOutputPath({ importedPath, fallbackName: "合并后的世界书" });

    expect(outputPath).toBe(importedPath);
  });

  it("uses the imported character card path when no explicit output path is provided", () => {
    const importedPath = path.resolve(ROOT_DIR, "模板角色卡.json");

    const outputPath = resolveCharacterCardOutputPath({ importedPath, fallbackName: "合并后的角色卡" });

    expect(outputPath).toBe(importedPath);
  });

  it("lets an explicit output path override the imported template path", () => {
    const importedPath = path.resolve(ROOT_DIR, "模板世界书.json");

    const outputPath = resolveWorldbookOutputPath({ explicitPath: "另存为.json", importedPath, fallbackName: "合并后的世界书" });

    expect(outputPath).toBe(path.resolve(ROOT_DIR, "另存为.json"));
  });
});

describe("buildCharacterCardJsonFromProject (force-safe contract)", () => {
  it("always returns a defined card even when delivery checklist is blocking", () => {
    // 项目有 card config 但 worldbook draft 为空（character_card 目标 worldbook 为 warning，
    // 不进 blocking；但开场白 + character_card 通常会触发 warning，足以测构建可用性）。
    const project = projectWithCard();
    const result = buildCharacterCardJsonFromProject(project);
    expect(result.card).toBeDefined();
    expect(result.card.name).toBe("角色A");
  });

  it("delivery checklist independently signals blocking; builder no longer short-circuits", () => {
    const project = projectWithCard({
      pendingDecisions: [{
        id: "card_type",
        question: "卡型？",
        options: [],
        allow_custom: true,
        multiple: false,
        created_at: "2026-01-01T00:00:00.000Z",
      }],
    });
    const checklist = createDeliveryChecklist({ project, export_target: "character_card" });
    expect(checklist.ready_to_export).toBe(false);
    // builder 仍能正常构建，不再依赖 cardValidation.valid
    const built = buildCharacterCardJsonFromProject(project);
    expect(built.card).toBeDefined();
    expect(built.card.name).toBe("角色A");
  });

  it("throws when characterCardConfig missing", () => {
    const project: Project = projectWithCard();
    delete (project as { characterCardConfig?: unknown }).characterCardConfig;
    expect(() => buildCharacterCardJsonFromProject(project)).toThrow(/character card config/);
  });
});
