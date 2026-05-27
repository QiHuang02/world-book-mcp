import { describe, expect, it } from "vitest";
import { updateEntryConfig, updateEntryContent } from "../src/core/semantic-editors.js";
import { createEntryTemplate } from "../src/core/templates-v3.js";
import { validateWorldbookDraft } from "../src/core/worldbook-validator.js";
import { createDraftSlice } from "../src/storage/draft-store.js";

describe("v3 worldbook entry editing", () => {
  it("creates a complete entry template with empty content", () => {
    const entry = createEntryTemplate({ comment: "嬴政-基础设定", entry_type: "character_basic", character_name: "嬴政" });

    expect(entry.comment).toBe("嬴政-基础设定");
    expect(entry.entryType).toBe("character_basic");
    expect(entry.characterName).toBe("嬴政");
    expect(entry.keys).toEqual(["嬴政"]);
    expect(entry.content).toBe("");
    expect(entry.preventRecursion).toBe(true);
    expect(entry.excludeRecursion).toBe(true);
  });

  it("updates entry content and config through semantic editors", () => {
    let slice = createDraftSlice({ type: "entry", id: "entry-1", data: createEntryTemplate({ comment: "嬴政-基础设定" }) });
    slice = updateEntryContent(slice, "---\n<entry>内容</entry>\n---");
    slice = updateEntryConfig(slice, { entryType: "character_basic", keys: [" 嬴政 ", "秦始皇", "嬴政", ""], secondaryKeys: ["始皇帝", " 始皇帝 "], characterName: " 嬴政 " });

    const data = slice.data as { entryType: string; keys: string[]; secondaryKeys: string[]; characterName: string; content: string };
    expect(data.entryType).toBe("character_basic");
    expect(data.keys).toEqual(["嬴政", "秦始皇"]);
    expect(data.secondaryKeys).toEqual(["始皇帝"]);
    expect(data.characterName).toBe("嬴政");
    expect(data.content).toBe("<entry>内容</entry>");
  });

  it("defaults green entries to scanDepth 2", () => {
    const entry = createEntryTemplate({ comment: "场景", constant: false });
    expect(entry.constant).toBe(false);
    expect(entry.scanDepth).toBe(2);
  });

  it("uses order recommendations from config rules", () => {
    expect(createEntryTemplate({ comment: "背景", entry_type: "background" }).order).toBe(2);
    expect(createEntryTemplate({ comment: "速览", entry_type: "character_overview" }).order).toBe(4);
  });

  it("reports incomplete entries through worldbook validator", () => {
    const result = validateWorldbookDraft([createEntryTemplate({ comment: "空内容" })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.field?.includes("content"))).toBe(true);
  });

  it("accepts complete entries", () => {
    const result = validateWorldbookDraft([{ ...createEntryTemplate({ comment: "条目A" }), keys: ["条目A"], content: "<entry>内容</entry>" }]);
    expect(result.valid).toBe(true);
  });
});
