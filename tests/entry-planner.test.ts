import { describe, expect, it } from "vitest";
import { planEntries } from "../src/core/entry-planner.js";
import type { ExtractionResult } from "../src/schemas/extraction.js";

const extraction: ExtractionResult = {
  projectId: "p1",
  title: "测试",
  characters: [
    { name: "角色A", aliases: ["A"], appearance: [], personalityEvidence: [], keyEvents: [], relationships: [], abilities: [], sourceRefs: [] },
    { name: "角色B", aliases: [], appearance: [], personalityEvidence: [], keyEvents: [], relationships: [], abilities: [], sourceRefs: [] },
  ],
  world: [{ name: "世界", type: "rule", facts: ["规则"], sourceRefs: [] }],
  items: [],
  events: [],
  sourceRefs: [],
};

describe("planEntries", () => {
  it("creates multi-character overview and triggered character entries", () => {
    const result = planEntries(extraction);
    expect(result.card_type).toBe("multi_character");
    expect(result.entries_plan.some((entry) => entry.entryType === "character_overview" && entry.constant)).toBe(true);
    expect(result.entries_plan.some((entry) => entry.comment === "角色A_基础设定" && !entry.constant && entry.keys.includes("角色A"))).toBe(true);
  });
});
