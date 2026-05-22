import { describe, expect, it } from "vitest";
import { normalizeWorldbookEntry, upsertWorldbookDraftEntry } from "../src/core/worldbook-entry-factory.js";


describe("worldbook entry factory", () => {
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

  it("updates by comment instead of duplicating", () => {
    const first = upsertWorldbookDraftEntry(undefined, { comment: "原初异质", keys: ["异质"], content: "旧" });
    const second = upsertWorldbookDraftEntry(first.entries, { comment: "原初异质", keys: ["原初异质"], content: "新" });

    expect(second.created).toBe(false);
    expect(second.entries).toHaveLength(1);
    expect(second.entries[0].content).toBe("新");
  });

  it("does not merge different comments with shared keys by default", () => {
    const first = upsertWorldbookDraftEntry(undefined, { comment: "角色B_基础设定", keys: ["角色B"], content: "基础" });
    const second = upsertWorldbookDraftEntry(first.entries, { comment: "角色B_性格", keys: ["角色B"], content: "性格" });

    expect(second.created).toBe(true);
    expect(second.entries).toHaveLength(2);
  });

  it("can explicitly update by keys", () => {
    const first = upsertWorldbookDraftEntry(undefined, { comment: "角色B_基础设定", keys: ["角色B"], content: "基础" });
    const second = upsertWorldbookDraftEntry(first.entries, { comment: "角色B", keys: ["角色B"], content: "合并" }, { matchByKeys: true });

    expect(second.created).toBe(false);
    expect(second.entries).toHaveLength(1);
    expect(second.entries[0].comment).toBe("角色B");
  });
});
