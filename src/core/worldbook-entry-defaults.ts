import type { EntryType } from "../schemas/worldbook-draft.js";

export function defaultOrderForEntryType(entryType: EntryType): number {
  switch (entryType) {
    case "world_summary":
      return 1;
    case "background":
      return 2;
    case "character_overview":
      return 4;
    case "character_basic":
      return 30;
    case "character_personality":
      return 31;
    case "faction":
      return 40;
    case "item":
    case "ability":
      return 50;
    case "scene":
    case "event":
      return 60;
    case "npc":
      return 70;
    case "other":
    default:
      return 100;
  }
}
