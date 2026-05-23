import { describe, expect, it } from "vitest";
import { confirmWorldbookDraftComplete, createWorldbookDraftTemplate, updateWorldbookDraftField, updateWorldbookDraftFields } from "../src/core/worldbook-draft-editor.js";
import type { WorldbookDraftEntry } from "../src/schemas/worldbook-draft.js";

function completeEntry(overrides: Partial<WorldbookDraftEntry> = {}): WorldbookDraftEntry {
  return {
    comment: "条目A",
    entryType: "other",
    keys: ["条目A"],
    secondaryKeys: [],
    content: "<entry>内容</entry>",
    constant: true,
    position: "before_char",
    order: 100,
    enabled: true,
    preventRecursion: true,
    excludeRecursion: true,
    ...overrides,
  };
}

describe("worldbook draft editor", () => {
  it("creates a complete draft template with empty content", () => {
    const entry = createWorldbookDraftTemplate({ comment: "嬴政-基础设定", entry_type: "character_basic", character_name: "嬴政" });

    expect(entry.comment).toBe("嬴政-基础设定");
    expect(entry.entryType).toBe("character_basic");
    expect(entry.characterName).toBe("嬴政");
    expect(entry.keys).toEqual(["嬴政"]);
    expect(entry.content).toBe("");
    expect(entry.preventRecursion).toBe(true);
    expect(entry.excludeRecursion).toBe(true);
  });

  it("updates field aliases and normalizes string arrays", () => {
    let entry = createWorldbookDraftTemplate({ comment: "嬴政-基础设定" });
    entry = updateWorldbookDraftField(entry, "entry_type", "character_basic");
    entry = updateWorldbookDraftField(entry, "keys", [" 嬴政 ", "秦始皇", "嬴政", ""]);
    entry = updateWorldbookDraftField(entry, "secondary_keys", ["始皇帝", " 始皇帝 "]);
    entry = updateWorldbookDraftField(entry, "character_name", " 嬴政 ");

    expect(entry.entryType).toBe("character_basic");
    expect(entry.keys).toEqual(["嬴政", "秦始皇"]);
    expect(entry.secondaryKeys).toEqual(["始皇帝"]);
    expect(entry.characterName).toBe("嬴政");
  });

  it("defaults green draft templates to scanDepth 2", () => {
    const entry = createWorldbookDraftTemplate({ comment: "场景", constant: false });

    expect(entry.constant).toBe(false);
    expect(entry.scanDepth).toBe(2);
  });

  it("uses order recommendations from config rules", () => {
    expect(createWorldbookDraftTemplate({ comment: "背景", entry_type: "background" }).order).toBe(2);
    expect(createWorldbookDraftTemplate({ comment: "速览", entry_type: "character_overview" }).order).toBe(4);
  });

  it("updates multiple fields", () => {
    const entry = updateWorldbookDraftFields(createWorldbookDraftTemplate({ comment: "条目" }), {
      content: "内容",
      constant: false,
      keys: ["触发词"],
      scan_depth: 2,
    });

    expect(entry.content).toBe("内容");
    expect(entry.constant).toBe(false);
    expect(entry.keys).toEqual(["触发词"]);
    expect(entry.scanDepth).toBe(2);
  });

  it("rejects invalid field values", () => {
    expect(() => updateWorldbookDraftField(createWorldbookDraftTemplate({ comment: "条目" }), "keys", "not-array")).toThrow();
  });

  it("reports incomplete drafts before merge without duplicating validator errors", () => {
    const result = confirmWorldbookDraftComplete([createWorldbookDraftTemplate({ comment: "空内容" })]);

    expect(result.ready_to_merge).toBe(false);
    expect(result.missing_fields.filter((issue) => issue.field === "content")).toHaveLength(1);
    expect(result.next_actions.some((action) => action.field === "content")).toBe(true);
  });

  it("confirms complete drafts", () => {
    const result = confirmWorldbookDraftComplete([completeEntry()]);

    expect(result.ready_to_merge).toBe(true);
    expect(result.ok).toBe(true);
  });
});
