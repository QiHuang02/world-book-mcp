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

  it("warns about forbidden content", () => {
    const result = validateWorldbookDraft([makeEntry({ content: "<character>\n一抹笑意\n</character>" })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.message.includes("一抹"))).toBe(true);
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
});
