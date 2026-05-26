import { WorldbookDraftEntrySchema, type WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { normalizeWorldbookEntryContent } from "../utils/yaml-xml.js";
import { createWorldbookDraftTemplate } from "./worldbook-draft-editor.js";

export function normalizeWorldbookEntry(input: Partial<WorldbookDraftEntry> & { comment: string; character_name?: string }): WorldbookDraftEntry {
  const template = createWorldbookDraftTemplate({ comment: input.comment, character_name: input.character_name });
  return WorldbookDraftEntrySchema.parse({
    ...template,
    ...input,
    characterName: input.characterName ?? input.character_name ?? template.characterName,
    content: normalizeWorldbookEntryContent(input.content ?? template.content),
  });
}

export function applyAddOrUpdateDraftEntry(existing: WorldbookDraftEntry[] | undefined, input: Partial<WorldbookDraftEntry> & { comment: string; character_name?: string }, options: { matchByKeys?: boolean } = {}): { action: "created" | "updated"; entry: WorldbookDraftEntry; entries: WorldbookDraftEntry[] } {
  const entries = [...(existing ?? [])];
  const entry = normalizeWorldbookEntry(input);
  const index = entries.findIndex((item) => item.comment === entry.comment || (options.matchByKeys && item.keys.some((key) => entry.keys.includes(key))));
  if (index >= 0) {
    entries[index] = entry;
    return { action: "updated", entry, entries };
  }
  entries.push(entry);
  return { action: "created", entry, entries };
}
