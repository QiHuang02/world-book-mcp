import { describe, expect, it } from "vitest";
import { buildChapterWorldbookEntries, createChapterExtractionTemplate } from "../src/core/chapter-extraction.js";

describe("chapter extraction", () => {
  it("creates chapter template with the requested chapter count", () => {
    const outline = createChapterExtractionTemplate({ title: "测试", chapter_count: 5 });
    expect(outline.chapters).toHaveLength(5);
    expect(outline.chapters[0].title).toBe("第1章");
  });

  it("builds keyword green entries with scanDepth=2", () => {
    const outline = createChapterExtractionTemplate({ chapter_count: 2 });
    outline.chapters[0].title = "第1章 序章";
    outline.chapters[0].summary = "正题展开";
    outline.chapters[0].key_events = ["林小雨初次登场"];
    const result = buildChapterWorldbookEntries(outline);
    expect(result.worldbookEntries[0].constant).toBe(false);
    expect(result.worldbookEntries[0].scanDepth).toBe(2);
    expect(result.worldbookEntries[0].keys).toContain("第1章 序章");
    expect(result.worldbookEntries[0].keys).toContain("林小雨初次登场");
  });
});
