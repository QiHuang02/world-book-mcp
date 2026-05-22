import { describe, expect, it } from "vitest";
import { buildCharacterCardJson } from "../src/core/character-card-builder.js";
import { buildEjsEntries } from "../src/core/ejs-entries.js";
import { createEjsTemplate } from "../src/core/ejs-template.js";
import { buildHtmlBeautifyAssets } from "../src/core/html-beautify-assets.js";
import { createHtmlBeautifyTemplate } from "../src/core/html-beautify-template.js";
import { buildMvuAssets } from "../src/core/mvu-assets.js";
import { createMvuTemplate } from "../src/core/mvu-template.js";
import type { CharacterCardConfig } from "../src/schemas/character-card.js";
import type { WorldbookDraftEntry } from "../src/schemas/worldbook-draft.js";

const config: CharacterCardConfig = {
  card: {
    name: "角色A",
    description: "",
    personality: "",
    scenario: "",
    first_mes: "你好。",
    alternate_greetings: ["晚上好。"],
    creator_notes: "",
    system_prompt: "",
    post_history_instructions: "",
    tags: ["test"],
    creator: "tester",
    character_version: "1.0",
    talkativeness: "0.5",
  },
  worldbook: { source: "project_draft", name: "角色A世界书" },
};

const draft: WorldbookDraftEntry[] = [
  {
    comment: "角色A_基础设定",
    entryType: "character_basic",
    keys: ["角色A"],
    secondaryKeys: [],
    content: "<character>\nname: 角色A\n基础: 设定\n</character>",
    constant: true,
    position: "after_char",
    order: 10,
    enabled: true,
    preventRecursion: true,
    excludeRecursion: true,
  },
  {
    comment: "角色A_性格设定",
    entryType: "character_personality",
    keys: ["A性格"],
    secondaryKeys: [],
    content: "性格: 冷静。",
    constant: true,
    position: "after_char",
    order: 11,
    enabled: true,
    preventRecursion: true,
    excludeRecursion: true,
  },
];

describe("buildCharacterCardJson", () => {
  it("builds chara_card_v3 json", () => {
    const card = buildCharacterCardJson({ config, worldbookEntries: draft, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(card.spec).toBe("chara_card_v3");
    expect(card.spec_version).toBe("3.0");
    expect(card.data.name).toBe("角色A");
    expect(card.data.character_book.entries).toHaveLength(1);
    expect(card.data.character_book.entries[0].comment).toBe("角色A");
    expect(card.data.character_book.entries[0].keys).toEqual(["角色A", "A性格"]);
    expect(card.data.character_book.entries[0].content).toContain("基础: 设定");
    expect(card.data.character_book.entries[0].content).toContain("性格: 冷静");
    expect(card.data.character_book.entries[0].extensions.prevent_recursion).toBe(true);
  });

  it("merges mvu assets", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const card = buildCharacterCardJson({ config, worldbookEntries: draft, mvuAssets: buildMvuAssets(mvu) });
    expect(card.data.character_book.entries.length).toBeGreaterThan(1);
    expect(card.data.extensions.regex_scripts?.length).toBeGreaterThan(0);
    expect(card.data.extensions.tavern_helper).toBeTruthy();
  });

  it("merges html assets with mvu regex scripts", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const { html } = createHtmlBeautifyTemplate({ target: "statusbar", theme: "minimal" });
    const card = buildCharacterCardJson({ config, worldbookEntries: draft, mvuAssets: buildMvuAssets(mvu), htmlAssets: buildHtmlBeautifyAssets(html) });
    expect(card.data.extensions.regex_scripts?.some((script) => String((script as any).scriptName).includes("状态栏"))).toBe(true);
    expect(card.data.extensions.regex_scripts?.some((script) => String((script as any).scriptName).includes("去除变量更新"))).toBe(true);
  });

  it("merges ejs entries into character book", () => {
    const { ejs } = createEjsTemplate({ templateType: "phase_profile", characterName: "角色A" });
    const card = buildCharacterCardJson({ config, worldbookEntries: draft, ejsEntries: buildEjsEntries(ejs).worldbookEntries });
    expect(card.data.character_book.entries.some((entry) => entry.comment === "角色A_阶段控制器")).toBe(true);
  });

  it("uses characterName before content name when grouping character entries", () => {
    const entries: WorldbookDraftEntry[] = [
      { ...draft[0], comment: "误导_基础设定", characterName: "真实角色", content: "name: 错误角色\n基础: A", keys: ["真实角色"] },
      { ...draft[1], comment: "误导_性格设定", characterName: "真实角色", content: "性格: B", keys: ["真实性格"] },
    ];
    const card = buildCharacterCardJson({ config, worldbookEntries: entries });
    expect(card.data.character_book.entries).toHaveLength(1);
    expect(card.data.character_book.entries[0].comment).toBe("真实角色");
    expect(card.data.character_book.entries[0].content).toContain("【基础设定】");
    expect(card.data.character_book.entries[0].content).toContain("【性格设定】");
  });

  it("does not mix multiple characters even when keys overlap", () => {
    const entries: WorldbookDraftEntry[] = [
      { ...draft[0], comment: "角色甲_基础设定", characterName: "角色甲", keys: ["共用"], content: "基础: 甲" },
      { ...draft[1], comment: "角色乙_性格设定", characterName: "角色乙", keys: ["共用"], content: "性格: 乙" },
    ];
    const card = buildCharacterCardJson({ config, worldbookEntries: entries });
    const comments = card.data.character_book.entries.map((entry) => entry.comment);
    expect(comments).toEqual(["角色甲", "角色乙"]);
  });

  it("infers character groups from comment suffix when content name is missing", () => {
    const entries: WorldbookDraftEntry[] = [
      { ...draft[0], comment: "角色丙_基础设定", content: "基础: 丙", keys: ["丙"] },
      { ...draft[1], comment: "角色丙_性格", content: "性格: 丙", keys: ["丙性格"] },
    ];
    const card = buildCharacterCardJson({ config, worldbookEntries: entries });
    expect(card.data.character_book.entries).toHaveLength(1);
    expect(card.data.character_book.entries[0].comment).toBe("角色丙");
  });

  it("preserves XML blocks while labeling non-XML character content", () => {
    const card = buildCharacterCardJson({ config, worldbookEntries: draft });
    const content = card.data.character_book.entries[0].content;
    expect(content.trim().startsWith("<character>")).toBe(true);
    expect(content).toContain("</character>");
    expect(content).toContain("【性格设定】");
  });
});
