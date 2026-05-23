import { describe, expect, it } from "vitest";
import { applyAddOrUpdateDraftEntry, normalizeWorldbookEntry } from "../src/core/worldbook-entry-factory.js";
import { CreateWorldbookDraftEntriesInputSchema } from "../src/schemas/worldbook-draft.js";


describe("worldbook entry normalizer", () => {
  it("expands simplified input into a draft entry", () => {
    const entry = normalizeWorldbookEntry({
      comment: "原初异质",
      keys: ["原初异质", "异质", "根源力量"],
      content: "根源力量。",
    });

    expect(entry.comment).toBe("原初异质");
    expect(entry.keys).toEqual(["原初异质", "异质", "根源力量"]);
    expect(entry.constant).toBe(true);
    expect(entry.position).toBe("before_char");
    expect(entry.enabled).toBe(true);
    expect(entry.preventRecursion).toBe(true);
    expect(entry.excludeRecursion).toBe(true);
  });

  it("applies add-or-update by comment instead of duplicating", () => {
    const first = applyAddOrUpdateDraftEntry(undefined, { comment: "原初异质", keys: ["异质"], content: "旧" });
    const second = applyAddOrUpdateDraftEntry(first.entries, { comment: "原初异质", keys: ["原初异质"], content: "新" });

    expect(second.action).toBe("updated");
    expect(second.entries).toHaveLength(1);
    expect(second.entries[0].content).toBe("新");
  });

  it("does not merge different comments with shared keys by default", () => {
    const first = applyAddOrUpdateDraftEntry(undefined, { comment: "角色B_基础设定", keys: ["角色B"], content: "基础" });
    const second = applyAddOrUpdateDraftEntry(first.entries, { comment: "角色B_性格", keys: ["角色B"], content: "性格" });

    expect(second.action).toBe("created");
    expect(second.entries).toHaveLength(2);
  });

  it("can explicitly update by keys", () => {
    const first = applyAddOrUpdateDraftEntry(undefined, { comment: "角色B_基础设定", keys: ["角色B"], content: "基础" });
    const second = applyAddOrUpdateDraftEntry(first.entries, { comment: "角色B", keys: ["角色B"], content: "合并" }, { matchByKeys: true });

    expect(second.action).toBe("updated");
    expect(second.entries).toHaveLength(1);
    expect(second.entries[0].comment).toBe("角色B");
  });

  it("stores character_name as characterName", () => {
    const result = applyAddOrUpdateDraftEntry(undefined, { comment: "角色C_基础设定", character_name: "角色C", keys: ["角色C"], content: "基础" });
    expect(result.entry.characterName).toBe("角色C");
  });

  it("rejects duplicate comments when creating draft templates in one batch", () => {
    const parsed = CreateWorldbookDraftEntriesInputSchema.safeParse({
      project_id: "project_test",
      entries: [
        { comment: "嬴政-性格" },
        { comment: "嬴政-性格" },
      ],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toContain("comment 重复");
  });
});
