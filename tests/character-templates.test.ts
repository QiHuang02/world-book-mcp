import { describe, expect, it } from "vitest";
import { createCharacterBasicEntryTemplate, createCharacterPersonalityEntryTemplate, validateCharacterAppearanceDistinctiveness, validateCharacterEntryStructure } from "../src/core/character-templates.js";

describe("character templates", () => {
  it("creates separated basic and personality templates", () => {
    expect(createCharacterBasicEntryTemplate({ character_name: "秋" }).template).toContain("<character>");
    expect(createCharacterPersonalityEntryTemplate({ character_name: "秋" }).template).toContain("<personality>");
  });

  it("rejects personality mixed into basic entry", () => {
    const result = validateCharacterEntryStructure({ kind: "basic", content: "<character>\nname: 秋\npersonality:\n  traits: []\n</character>" });
    expect(result.valid).toBe(false);
  });

  it("warns about universal beauty terms", () => {
    const result = validateCharacterAppearanceDistinctiveness("appearance:\n  face: 精致漂亮");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
