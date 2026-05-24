import { SillyTavernWorldbookSchema, type SillyTavernWorldbook, type SillyTavernWorldbookEntry } from "../schemas/sillytavern-worldbook.js";
import type { EntryType, WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { readJsonFile } from "../utils/json.js";
import { normalizeWorldbookEntryContent } from "../utils/yaml-xml.js";
import { numberToPosition } from "./position-map.js";

export async function importWorldbookFromFile(path: string): Promise<{ book: SillyTavernWorldbook; draft: WorldbookDraftEntry[] }> {
  const book = await readJsonFile(path, SillyTavernWorldbookSchema);
  return { book, draft: worldbookToDraft(book) };
}

export function worldbookToDraft(book: SillyTavernWorldbook): WorldbookDraftEntry[] {
  return Object.values(book.entries)
    // uid/order/displayIndex 取 0 是合法值，使用 ?? 而非 || 防止把 0 误当成"未提供"再被 index 顶替。
    .map((entry, index) => ({ ...entry, uid: entry.uid ?? index, order: entry.order ?? index, displayIndex: entry.displayIndex ?? index }))
    .sort((a, b) => a.uid - b.uid)
    .map(entryToDraft);
}

function entryToDraft(entry: SillyTavernWorldbookEntry): WorldbookDraftEntry {
  return {
    comment: entry.comment || `uid_${entry.uid}`,
    entryType: inferEntryType(entry),
    keys: entry.key ?? [],
    secondaryKeys: entry.keysecondary ?? [],
    content: normalizeWorldbookEntryContent(entry.content ?? ""),
    sourceUid: entry.uid,
    constant: entry.constant,
    position: numberToPosition(entry.position) ?? "after_char",
    order: entry.order,
    enabled: !entry.disable,
    depth: entry.depth,
    scanDepth: entry.scanDepth ?? undefined,
    preventRecursion: true,
    excludeRecursion: true,
  };
}

function inferEntryType(entry: SillyTavernWorldbookEntry): EntryType {
  const content = entry.content.trim();
  if (/^<character>[\s\S]*<\/character>$/.test(content)) return "character_basic";
  if (/^<personality>[\s\S]*<\/personality>$/.test(content)) return "character_personality";
  if (/^<item>[\s\S]*<\/item>$/.test(content)) return "item";
  if (/^<ability>[\s\S]*<\/ability>$/.test(content)) return "ability";
  if (/^<scene>[\s\S]*<\/scene>$/.test(content)) return "scene";
  if (/^<event>[\s\S]*<\/event>$/.test(content)) return "event";
  if (entry.comment.includes("总纲") || entry.position === 0) return "world_summary";
  return "other";
}
