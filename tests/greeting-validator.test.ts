import { describe, expect, it } from "vitest";
import { validateGreetings } from "../src/core/greeting-validator.js";
import type { CharacterCardConfig } from "../src/schemas/character-card.js";

function makeConfig(first_mes: string): CharacterCardConfig {
  return {
    card: {
      name: "角色A",
      description: "",
      personality: "",
      scenario: "",
      first_mes,
      alternate_greetings: ["夜里，角色A站在门口，看向你。", "雨声落在窗边，角色A把杯子递到你面前。"],
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      tags: [],
      creator: "",
      character_version: "1.0",
      talkativeness: "0.5",
    },
    worldbook: { source: "none" },
  };
}

describe("validateGreetings", () => {
  it("warns about user preset actions", () => {
    const result = validateGreetings({ config: makeConfig("清晨，角色A站在窗边，看见你刚刚醒来。") });
    expect(result.warnings.some((issue) => issue.message.includes("预设 user"))).toBe(true);
  });

  it("warns when mvu placeholder is missing", () => {
    const result = validateGreetings({ config: makeConfig("清晨，角色A站在门口，看向你。"), mvu_enabled: true });
    expect(result.warnings.some((issue) => issue.message.includes("StatusPlaceHolderImpl"))).toBe(true);
  });

  it("warns about user preset follow-up choices", () => {
    const result = validateGreetings({ config: makeConfig("夜里，角色A站在门口，看向你。你只好点头跟着他离开。") });
    expect(result.warnings.some((issue) => issue.message.includes("后续行动"))).toBe(true);
  });
});
