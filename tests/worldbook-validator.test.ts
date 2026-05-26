import { describe, expect, it } from "vitest";
import { validateWorldbookDraft } from "../src/core/worldbook-validator.js";
import type { WorldbookDraftEntry } from "../src/schemas/worldbook-draft.js";

function makeEntry(overrides: Partial<WorldbookDraftEntry> = {}): WorldbookDraftEntry {
  return {
    comment: "角色A_基础设定",
    entryType: "character_basic",
    keys: ["角色A"],
    secondaryKeys: [],
    content: "<character>\nname: 角色A\n</character>",
    constant: false,
    position: "after_char",
    order: 10,
    enabled: true,
    preventRecursion: true,
    excludeRecursion: true,
    ...overrides,
  };
}

describe("validateWorldbookDraft", () => {
  it("rejects green entries without keys", () => {
    const result = validateWorldbookDraft([makeEntry({ keys: [] })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.field === "keys")).toBe(true);
  });

  it("does not reject subjective banned terms", () => {
    const result = validateWorldbookDraft([makeEntry({ content: "<character>\n一抹笑意、嘴角上扬、眸光\n</character>", scanDepth: 2 })]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("warns about duplicate comments", () => {
    const result = validateWorldbookDraft([makeEntry(), makeEntry({ order: 11 })]);
    expect(result.warnings.some((issue) => issue.field === "comment")).toBe(true);
  });

  it("rejects blank keys", () => {
    const result = validateWorldbookDraft([makeEntry({ keys: [" "] })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.message.includes("不能为空白"))).toBe(true);
  });

  it("warns when green entries do not set scanDepth", () => {
    const result = validateWorldbookDraft([makeEntry({ scanDepth: undefined })]);
    expect(result.warnings.some((issue) => issue.field === "scanDepth")).toBe(true);
  });

  it("warns when a key contains comma-separated values", () => {
    const result = validateWorldbookDraft([makeEntry({ keys: ["角色A,别名A"], scanDepth: 2 })]);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((issue) => issue.message.includes("多个触发词"))).toBe(true);
  });

  it("rejects content containing a YAML doc separator `---`", () => {
    const result = validateWorldbookDraft([
      makeEntry({ content: "---\n<character>\nname: 角色A\n</character>", scanDepth: 2 }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.message.includes("YAML 文档分隔符"))).toBe(true);
  });

  it("rejects content with a trailing `---`", () => {
    const result = validateWorldbookDraft([
      makeEntry({ content: "<character>\nname: 角色A\n</character>\n---", scanDepth: 2 }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.message.includes("YAML 文档分隔符"))).toBe(true);
  });

  it("does not reject a natural-language ellipsis line `...`", () => {
    const result = validateWorldbookDraft([
      makeEntry({ content: "<character>\nname: 角色A\n...\n</character>", scanDepth: 2 }),
    ]);
    expect(result.errors.some((issue) => issue.message.includes("YAML 文档分隔符"))).toBe(false);
  });
});
