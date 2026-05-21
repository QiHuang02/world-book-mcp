import { describe, expect, it } from "vitest";
import { validateCharacterCardConfig } from "../src/core/character-card-validator.js";
import type { CharacterCardConfig } from "../src/schemas/character-card.js";

function makeConfig(overrides: Partial<CharacterCardConfig["card"]> = {}): CharacterCardConfig {
  return {
    card: {
      name: "角色A",
      description: "",
      personality: "",
      scenario: "",
      first_mes: "你好。",
      alternate_greetings: [],
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      tags: [],
      creator: "",
      character_version: "1.0",
      talkativeness: "0.5",
      ...overrides,
    },
    worldbook: { source: "none" },
  };
}

describe("validateCharacterCardConfig", () => {
  it("rejects missing first_mes", () => {
    const result = validateCharacterCardConfig({ config: makeConfig({ first_mes: "" }) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.field === "card.first_mes")).toBe(true);
  });

  it("warns when description is not empty", () => {
    const result = validateCharacterCardConfig({ config: makeConfig({ description: "不应写这里" }) });
    expect(result.warnings.some((issue) => issue.field === "card.description")).toBe(true);
  });

  it("rejects project_draft without draft", () => {
    const config = makeConfig();
    config.worldbook = { source: "project_draft" };
    const result = validateCharacterCardConfig({ config });
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.field === "worldbook.source")).toBe(true);
  });
});
