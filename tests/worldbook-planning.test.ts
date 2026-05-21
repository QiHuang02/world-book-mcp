import { describe, expect, it } from "vitest";
import { classifyWorldbookCardType, createWorldbookEntryPlan, validateWorldbookEntryPlan } from "../src/core/worldbook-planning.js";

describe("worldbook planning", () => {
  it("classifies single character cards", () => {
    const result = classifyWorldbookCardType({ core_character_count: 1, has_character_card: true });
    expect(result.card_type).toBe("single_character_card");
  });

  it("plans multi character details as keyword entries", () => {
    const result = createWorldbookEntryPlan({ card_type: "multi_character_card", characters: [{ name: "甲" }, { name: "乙" }] });
    const detail = result.entries_plan.find((entry) => entry.comment === "甲_基础设定");
    expect(detail?.constant).toBe(false);
    expect(detail?.keys).toContain("甲");
  });

  it("rejects keyword plans without keys", () => {
    const result = validateWorldbookEntryPlan({ card_type: "multi_character_card", plan: [{ comment: "坏条目", entryType: "item", position: "after_char", order: 50, constant: false, keys: [], reason: "test" }] });
    expect(result.valid).toBe(false);
  });
});
