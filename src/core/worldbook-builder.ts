import type { SillyTavernWorldbook, SillyTavernWorldbookEntry } from "../schemas/sillytavern-worldbook.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { positionToNumber } from "./position-map.js";

export function buildWorldbookJson(input: { name: string; entries: WorldbookDraftEntry[] }): SillyTavernWorldbook {
  const sorted = [...input.entries].sort((a, b) => {
    const positionDiff = positionToNumber(a.position) - positionToNumber(b.position);
    return positionDiff || a.order - b.order || a.comment.localeCompare(b.comment, "zh-Hans-CN");
  });

  const entries: Record<string, SillyTavernWorldbookEntry> = {};
  sorted.forEach((draft, index) => {
    entries[String(index)] = buildEntry(draft, index);
  });

  return { name: input.name, entries };
}

function buildEntry(draft: WorldbookDraftEntry, uid: number): SillyTavernWorldbookEntry {
  return {
    uid,
    key: draft.keys,
    keysecondary: draft.secondaryKeys ?? [],
    comment: draft.comment,
    content: draft.content,
    constant: draft.constant,
    vectorized: false,
    selective: false,
    selectiveLogic: 0,
    addMemo: true,
    order: draft.order,
    position: positionToNumber(draft.position),
    disable: !draft.enabled,
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
    depth: draft.position === "at_depth" ? draft.depth ?? 0 : draft.depth ?? 1,
    outletName: "",
    group: "",
    groupOverride: false,
    groupWeight: 100,
    scanDepth: draft.scanDepth ?? (!draft.constant ? 2 : null),
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: false,
    automationId: "",
    role: draft.position === "at_depth" ? 0 : 0,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    triggers: [],
    displayIndex: uid,
    extensions: {},
    characterFilter: { isExclude: false, names: [], tags: [] },
  };
}
