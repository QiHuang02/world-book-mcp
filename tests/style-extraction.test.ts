import { describe, expect, it } from "vitest";
import { buildStyleWorldbookEntries, createStyleExtractionTemplate } from "../src/core/style-extraction.js";

describe("style extraction", () => {
  it("creates a default style profile template", () => {
    const result = createStyleExtractionTemplate();
    expect(result.profile.narrative_perspective).toBe("third_person_limited");
    expect(result.rules.length).toBeGreaterThan(0);
  });

  it("builds before_an constant entries from profile", () => {
    const { profile } = createStyleExtractionTemplate();
    profile.signature_techniques = ["大量短句"];
    profile.forbidden_terms = ["一丝"];
    profile.positive_rules = ["白描优先"];
    const result = buildStyleWorldbookEntries(profile);
    expect(result.worldbookEntries.length).toBeGreaterThanOrEqual(2);
    expect(result.worldbookEntries.every((entry) => entry.constant && entry.position === "before_an")).toBe(true);
    expect(result.worldbookEntries.some((entry) => entry.comment.endsWith("禁律"))).toBe(true);
  });
});
