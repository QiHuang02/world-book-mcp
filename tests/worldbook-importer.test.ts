import { describe, expect, it } from "vitest";
import { worldbookToDraft } from "../src/core/worldbook-importer.js";
import type { SillyTavernWorldbook } from "../src/schemas/sillytavern-worldbook.js";

const book: SillyTavernWorldbook = {
  name: "导入测试",
  entries: {
    "0": {
      uid: 0,
      key: ["角色A"],
      keysecondary: [],
      comment: "角色A_基础设定",
      content: "<character>\nname: 角色A\n</character>",
      constant: false,
      vectorized: false,
      selective: false,
      selectiveLogic: 0,
      addMemo: true,
      order: 10,
      position: 1,
      disable: true,
      ignoreBudget: false,
      excludeRecursion: true,
      preventRecursion: true,
      matchPersonaDescription: false,
      matchCharacterDescription: false,
      matchCharacterPersonality: false,
      matchCharacterDepthPrompt: false,
      matchScenario: false,
      matchCreatorNotes: false,
      delayUntilRecursion: false,
      probability: 100,
      useProbability: true,
      depth: 1,
      outletName: "",
      group: "",
      groupOverride: false,
      groupWeight: 100,
      scanDepth: 2,
      caseSensitive: null,
      matchWholeWords: null,
      useGroupScoring: false,
      automationId: "",
      role: 0,
      sticky: 0,
      cooldown: 0,
      delay: 0,
      triggers: [],
      displayIndex: 0,
      extensions: {},
      characterFilter: { isExclude: false, names: [], tags: [] },
    },
  },
};

describe("worldbookToDraft", () => {
  it("converts SillyTavern entries to draft entries", () => {
    const draft = worldbookToDraft(book);
    expect(draft[0].position).toBe("after_char");
    expect(draft[0].enabled).toBe(false);
    expect(draft[0].entryType).toBe("character_basic");
    expect(draft[0].preventRecursion).toBe(true);
  });
});
