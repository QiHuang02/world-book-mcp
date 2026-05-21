import { describe, expect, it } from "vitest";
import { buildWorldbookJson } from "../src/core/worldbook-builder.js";
import type { WorldbookDraftEntry } from "../src/schemas/worldbook-draft.js";

const entry: WorldbookDraftEntry = {
  comment: "世界观总纲",
  entryType: "world_summary",
  keys: [],
  secondaryKeys: [],
  content: "世界类型: 现代奇幻",
  constant: true,
  position: "before_char",
  order: 1,
  enabled: true,
  preventRecursion: true,
  excludeRecursion: true,
};

describe("buildWorldbookJson", () => {
  it("builds SillyTavern worldbook entries", () => {
    const book = buildWorldbookJson({ name: "测试世界书", entries: [entry] });
    expect(book.name).toBe("测试世界书");
    expect(book.entries["0"].uid).toBe(0);
    expect(book.entries["0"].position).toBe(0);
    expect(book.entries["0"].preventRecursion).toBe(true);
    expect(book.entries["0"].excludeRecursion).toBe(true);
  });

  it("defaults green scanDepth to 2", () => {
    const book = buildWorldbookJson({ name: "测试世界书", entries: [{ ...entry, constant: false, keys: ["关键词"], position: "after_char" }] });
    expect(book.entries["0"].scanDepth).toBe(2);
  });

  it("defaults at_depth depth to 0", () => {
    const book = buildWorldbookJson({ name: "测试世界书", entries: [{ ...entry, position: "at_depth", depth: undefined }] });
    expect(book.entries["0"].depth).toBe(0);
  });
});
