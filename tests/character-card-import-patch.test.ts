import { describe, expect, it } from "vitest";
import { buildCharacterCardJson } from "../src/core/character-card-builder.js";
import { buildCharacterCardJsonFromProject } from "../src/core/character-card-project-builder.js";
import { buildMvuAssets } from "../src/core/mvu-assets.js";
import { createMvuTemplate } from "../src/core/mvu-template.js";
import { characterCardToProjectData } from "../src/core/character-card-importer.js";
import { applyCharacterCardPatchToProject, createCharacterCardPatch, previewCharacterCardPatch } from "../src/core/character-card-patch.js";
import type { CharacterCardConfig } from "../src/schemas/character-card.js";
import type { Project } from "../src/schemas/project.js";
import type { WorldbookDraftEntry } from "../src/schemas/worldbook-draft.js";

const config: CharacterCardConfig = {
  card: {
    name: "导入角色",
    description: "",
    personality: "",
    scenario: "旧场景",
    first_mes: "旧开场",
    alternate_greetings: [],
    creator_notes: "",
    system_prompt: "",
    post_history_instructions: "",
    tags: [],
    creator: "tester",
    character_version: "1.0",
    talkativeness: "0.5",
  },
  worldbook: { source: "project_draft", name: "导入角色世界书" },
};

const draft: WorldbookDraftEntry[] = [{
  comment: "导入角色_基础设定",
  entryType: "character_basic",
  keys: ["导入角色"],
  secondaryKeys: [],
  content: "<character>\nname: 导入角色\n</character>",
  constant: true,
  position: "after_char",
  order: 10,
  enabled: true,
  preventRecursion: true,
  excludeRecursion: true,
}];

function project(): Project {
  return {
    id: "project_card_patch",
    name: "导入角色",
    sources: [],
    research: [],
    patches: [],
    characterCardPatches: [],
    pendingDecisions: [],
    recordedDecisions: [],
    characterCardConfig: config,
    draft,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("character card import and patch", () => {
  it("imports chara_card_v3 config and embedded worldbook draft", () => {
    const card = buildCharacterCardJson({ config, worldbookEntries: draft, createdAt: "2026-01-01T00:00:00.000Z" });
    const imported = characterCardToProjectData(card);

    expect(imported.config.card.name).toBe("导入角色");
    expect(imported.config.card.first_mes).toBe("旧开场");
    expect(imported.config.worldbook.source).toBe("project_draft");
    expect(imported.draft).toHaveLength(1);
    expect(imported.draft[0].comment).toBe("导入角色");
  });

  it("imports external character book entry aliases", () => {
    const imported = characterCardToProjectData({
      name: "外部角色",
      data: {
        name: "外部角色",
        character_book: {
          name: "外部世界书",
          entries: [{
            key: ["别名关键词"],
            keysecondary: ["次要词"],
            comment: "外部条目",
            content: "<entry>外部</entry>",
            constant: false,
            order: 88,
            disable: true,
            position: 4,
            depth: 0,
            scanDepth: 3,
          }],
        },
      },
    });

    expect(imported.draft[0].keys).toEqual(["别名关键词"]);
    expect(imported.draft[0].secondaryKeys).toEqual(["次要词"]);
    expect(imported.draft[0].order).toBe(88);
    expect(imported.draft[0].enabled).toBe(false);
    expect(imported.draft[0].position).toBe("at_depth");
    expect(imported.draft[0].scanDepth).toBe(3);
  });

  it("previews and applies profile and embedded worldbook patches", () => {
    const patch = createCharacterCardPatch({
      projectId: "project_card_patch",
      operations: [
        { op: "update_profile", changes: { first_mes: "新开场", scenario: "新场景" } },
        { op: "worldbook_patch", operation: { op: "add_entry", entry: { comment: "新增条目", entryType: "other", keys: ["新增"], secondaryKeys: [], content: "<entry>新增</entry>", constant: true, position: "before_char", order: 20, enabled: true, preventRecursion: true, excludeRecursion: true } } },
      ],
    });

    const preview = previewCharacterCardPatch(project(), patch);
    expect(preview.diff.length).toBeGreaterThanOrEqual(2);
    expect(preview.validation.valid).toBe(true);

    const applied = applyCharacterCardPatchToProject(project(), patch.operations);
    expect(applied.project.characterCardConfig?.card.first_mes).toBe("新开场");
    expect(applied.project.characterCardConfig?.card.scenario).toBe("新场景");
    expect(applied.project.draft).toHaveLength(2);
  });

  it("updates worldbook config", () => {
    const applied = applyCharacterCardPatchToProject(project(), [{ op: "update_worldbook_config", changes: { source: "none" } }]);
    expect(applied.project.characterCardConfig?.worldbook.source).toBe("none");
    expect(applied.validation.valid).toBe(true);
  });

  it("builds patched cards with project MVU assets", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["导入角色"] });
    const patched = applyCharacterCardPatchToProject({ ...project(), mvuConfig: mvu }, [{ op: "update_profile", changes: { first_mes: "带变量开场" } }]);
    const { card, validation } = buildCharacterCardJsonFromProject(patched.project);

    expect(validation.valid).toBe(true);
    expect(card.data.extensions.regex_scripts?.length).toBeGreaterThan(0);
    expect(card.data.extensions.tavern_helper).toBeTruthy();
    expect(card.data.character_book.entries.length).toBeGreaterThan(buildMvuAssets(mvu).worldbookEntries.length - 1);
  });
});
