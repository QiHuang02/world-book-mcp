import type { CreateWorldbookDraftTemplateInput, WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { uniqueStrings } from "../utils/strings.js";
import { defaultOrderForEntryType } from "./worldbook-entry-defaults.js";

export function createWorldbookDraftTemplate(input: CreateWorldbookDraftTemplateInput): WorldbookDraftEntry {
  const comment = input.comment.trim();
  const entryType = input.entryType ?? input.entry_type ?? "other";
  const characterName = input.characterName ?? input.character_name;
  const keySeed = characterName?.trim() || comment;
  const constant = input.constant ?? true;
  const scanDepth = input.scanDepth ?? input.scan_depth ?? (!constant ? 2 : undefined);
  return {
    comment,
    entryType,
    keys: uniqueStrings([keySeed]),
    secondaryKeys: [],
    content: "",
    ...(characterName?.trim() ? { characterName: characterName.trim() } : {}),
    constant,
    position: input.position ?? "before_char",
    order: input.order ?? defaultOrderForEntryType(entryType),
    enabled: input.enabled ?? true,
    ...(scanDepth === null || scanDepth === undefined ? {} : { scanDepth }),
    preventRecursion: true,
    excludeRecursion: true,
  };
}
